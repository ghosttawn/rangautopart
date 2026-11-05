import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (req, res): Promise<void> => {
  try {
    await db.execute(sql`select 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.set("Cache-Control", "no-store").json(data);
  } catch (err) {
    req.log.error({ err }, "Health check could not reach the database");
    res.status(503).set("Cache-Control", "no-store").json({
      error: "The database is temporarily unavailable.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
});

export default router;
