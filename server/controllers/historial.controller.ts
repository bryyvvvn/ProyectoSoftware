import { Request, Response } from "express";
import { HistorialService } from "../services/Historial.service";
import { ErrorResponse } from "../utils/ErrorResponse";

export class HistorialController {
  static async getHistorial(req: Request, res: Response) {
    const { rut, codcarrera } = req.params ?? {};

    if (!rut || !codcarrera) {
      return res.status(400).json({ error: "Debe indicar rut y codcarrera" });
    }

    try {
      const historial = await HistorialService.obtenerHistorial(rut, codcarrera);
      return res.status(200).json(historial);
    } catch (error) {
      return ErrorResponse.handle(error, res);
    }
  }
}
