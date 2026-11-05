import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { HttpError } from "./middlewares/auth";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// The Clerk Frontend API proxy must receive the untouched request body.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  cors((req, callback) => {
    const origin = req.header("origin");
    const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || req.header("host");
    if (!origin || !requestHost) {
      callback(null, { origin: false });
      return;
    }
    try {
      const isSameOrigin = new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
      callback(null, {
        origin: isSameOrigin,
        credentials: isSameOrigin,
      });
    } catch {
      callback(null, { origin: false });
    }
  }),
);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      req.hostname,
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api", apiLimiter, (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.header("origin");
    const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || req.header("host");
    if (origin && requestHost) {
      try {
        if (new URL(origin).host.toLowerCase() !== requestHost.toLowerCase()) {
          res.status(403).json({
            error: "This request could not be verified.",
            code: "CROSS_ORIGIN_REQUEST",
          });
          return;
        }
      } catch {
        res.status(403).json({
          error: "This request could not be verified.",
          code: "CROSS_ORIGIN_REQUEST",
        });
        return;
      }
    }
  }
  next();
});

app.use("/api", router);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "LIMIT_FILE_SIZE"
  ) {
    res.status(413).json({
      error: "Image files must be 5 MB or smaller.",
      code: "IMAGE_TOO_LARGE",
    });
    return;
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    if (err.code === "23505" || err.code === "23503") {
      res.status(409).json({
        error: "That value conflicts with an existing record.",
        code: "RECORD_CONFLICT",
      });
      return;
    }
  }
  req.log.error({ err }, "Request failed");
  res.status(500).json({
    error: "An unexpected error occurred. Please try again.",
    code: "INTERNAL_ERROR",
  });
});

export default app;
