import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { HttpError } from "./middlewares/auth";

const app: Express = express();
app.set("trust proxy", 1);

const configuredOrigins = (process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      const parsed = new URL(value);
      if (
        !["https:", "http:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error("invalid origin");
      }
      return parsed.origin.toLowerCase();
    } catch {
      throw new Error("FRONTEND_ORIGINS must contain exact HTTP(S) origins without paths.");
    }
  });

if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
  throw new Error("Set FRONTEND_ORIGINS to the exact deployed storefront origin.");
}

function isAllowedOrigin(origin: string, req: express.Request): boolean {
  try {
    const parsedOrigin = new URL(origin);
    if (configuredOrigins.includes(parsedOrigin.origin.toLowerCase())) return true;
    const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || req.header("host");
    const forwardedProtocol = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
    const requestProtocol = forwardedProtocol
      ? `${forwardedProtocol.replace(/:$/, "")}:`
      : `${req.protocol}:`;
    return Boolean(
      requestHost &&
        parsedOrigin.host.toLowerCase() === requestHost.toLowerCase() &&
        parsedOrigin.protocol.toLowerCase() === requestProtocol.toLowerCase(),
    );
  } catch {
    return false;
  }
}

app.use(
  pinoHttp({
    logger,
    redact: {
      paths: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
      censor: "[Redacted]",
    },
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

app.use(
  cors((req, callback) => {
    const origin = req.header("origin");
    if (!origin) {
      callback(null, { origin: false });
      return;
    }
    const allowed = isAllowedOrigin(origin, req);
    callback(null, { origin: allowed, credentials: allowed });
  }),
);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api", apiLimiter, (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.header("origin");
    if (origin && !isAllowedOrigin(origin, req)) {
      res.status(403).json({
        error: "This request could not be verified.",
        code: "CROSS_ORIGIN_REQUEST",
      });
      return;
    }
  }
  next();
});

app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "That API route was not found.",
    code: "API_ROUTE_NOT_FOUND",
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: "That route was not found.",
    code: "ROUTE_NOT_FOUND",
  });
});

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
  if (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.parse.failed"
  ) {
    res.status(400).json({
      error: "The request body is not valid JSON.",
      code: "INVALID_JSON",
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
