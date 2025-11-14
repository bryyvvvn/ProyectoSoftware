import { Router } from "express";
import { ProjectionController } from "./projection.controller";

export function createProjectionRouter(controller: ProjectionController) {
  const router = Router();
  router.post("/projections", controller.create);
  return router;
}
