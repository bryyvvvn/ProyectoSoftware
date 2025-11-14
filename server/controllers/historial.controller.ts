import { Request, Response } from "express";
import { HistorialService } from "../services/Historial.service";
import { ErrorResponse } from "../utils/ErrorResponse";

/**
 * Controlador del historial académico.
 */
export class HistorialController {
  /**
   * Obtiene el historial académico de un estudiante.
   * @param req Request
   * @param res Response
   */
  public static async getHistorial(req: Request, res: Response) {
    try {
      const { rut, codcarrera } = req.params;

      if (!rut || !codcarrera) {
        return res.status(400).json({ error: "Se requieren los parámetros rut y codcarrera" });
      }

      const historial = await HistorialService.obtenerHistorial(rut, codcarrera);
      return res.status(200).json(historial);
    } catch (error) {
      return ErrorResponse.handle(error, res);
    }
  }
}
