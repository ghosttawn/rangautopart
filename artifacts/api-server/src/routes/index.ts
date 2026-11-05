import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storefrontRouter from "./storefront";
import ordersRouter from "./orders";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storefrontRouter);
router.use(ordersRouter);
router.use(adminRouter);

export default router;
