import { Request, Response } from "express";
import { MallaService } from "../services/Malla.service";
import { ErrorResponse } from "../utils/ErrorResponse";

/**
 * Controlador para operaciones de malla académica.
 */
export class MallaController {
  /**
   * Retorna la lista de cursos para la combinación de código y catálogo.
   * @param req Request
   * @param res Response
   */
  public static async getCursos(req: Request, res: Response) {
    try {
      const { codigo, catalogo } = req.params;

      if (!codigo || !catalogo) {
        return res.status(400).json({ error: "Se requieren los parámetros codigo y catalogo" });
      }

      const cursos = await MallaService.obtenerMalla(codigo, catalogo);
      return res.status(200).json(cursos);
    } catch (error) {
      return ErrorResponse.handle(error, res);
    }
  }
}
