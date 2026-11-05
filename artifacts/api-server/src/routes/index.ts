import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storefrontRouter from "./storefront";
import ordersRouter from "./orders";
import adminRouter from "./admin";
import authRouter from "./auth";
import seoRouter from "./seo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(seoRouter);
router.use(storefrontRouter);
router.use(ordersRouter);
router.use(adminRouter);

export default router;
