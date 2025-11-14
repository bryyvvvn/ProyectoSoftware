import { NextFunction, Request, Response } from "express";
import { ApiError } from "../../errors/ApiError";
import { ProjectionService } from "./projection.service";

export class ProjectionController {
  constructor(private readonly projectionService: ProjectionService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceProjectionId, nombreVersion } = req.body ?? {};
      const sanitizedName = typeof nombreVersion === "string" ? nombreVersion : undefined;
      if (sourceProjectionId === undefined || sourceProjectionId === null) {
        throw ApiError.badRequest("sourceProjectionId es obligatorio para clonar una proyección existente");
      }

      const projectionId = Number(sourceProjectionId);
      if (!Number.isInteger(projectionId)) {
        throw ApiError.badRequest("sourceProjectionId debe ser numérico");
      }

      const data = await this.projectionService.cloneProjection({
        projectionId,
        nombreVersion: sanitizedName,
      });

      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  };

  cloneFromParam = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(projectionId)) {
        throw ApiError.badRequest("El id de proyección debe ser numérico");
      }

      const { nombreVersion } = req.body ?? {};
      const sanitizedName = typeof nombreVersion === "string" ? nombreVersion : undefined;
      const proyeccion = await this.projectionService.cloneProjection({
        projectionId,
        nombreVersion: sanitizedName,
      });

      res.status(201).json({
        message: "Proyección clonada correctamente",
        proyeccion,
      });
    } catch (error) {
      next(error);
    }
  };
}
