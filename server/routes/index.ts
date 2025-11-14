import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { MallaController } from "../controllers/malla.controller";
import { HistorialController } from "../controllers/historial.controller";

const router = Router();

router.post("/api/auth/login", AuthController.login);
router.get("/api/malla/:codigo/:catalogo", MallaController.getCursos);
router.get("/api/historial/:rut/:codcarrera", HistorialController.getHistorial);

export default router;
