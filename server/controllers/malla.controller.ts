import { Request, Response } from "express";
import { MallaService } from "../services/Malla.service";
import { ErrorResponse } from "../utils/ErrorResponse";

export class MallaController {
  static async getCursos(req: Request, res: Response) {
    try {
      const { codigo, catalogo } = req.params;
      if (!codigo || !catalogo) {
        return res.status(400).json({ error: "Debe indicar código y catálogo" });
      }

      const cursos = await MallaService.obtenerMalla(codigo, catalogo);
      return res.status(200).json(cursos);
    } catch (error) {
      return ErrorResponse.handle(error, res);
    }
  }
}
