import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import productionRouter from "./production";
import inventoryRouter from "./inventory";
import salesRouter from "./sales";
import ordersRouter from "./orders";
import deliveriesRouter from "./deliveries";
import wholesaleRouter from "./wholesale";
import employeesRouter from "./employees";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(productionRouter);
router.use(inventoryRouter);
router.use(salesRouter);
router.use(ordersRouter);
router.use(deliveriesRouter);
router.use(wholesaleRouter);
router.use(employeesRouter);
router.use(paymentsRouter);
router.use(dashboardRouter);

export default router;
