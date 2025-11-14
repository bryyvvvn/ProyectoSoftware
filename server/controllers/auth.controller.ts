import { Request, Response } from "express";
import { AuthService } from "../services/Auth.service";
import { ErrorResponse } from "../utils/ErrorResponse";

/**
 * Controlador HTTP para autenticación.
 */
export class AuthController {
  /**
   * Maneja la petición de login.
   * @param req Request
   * @param res Response
   */
  public static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Faltan username o password" });
      }

      const userData = await AuthService.authenticate(username, password);
      return res.status(200).json(userData);
    } catch (error) {
      return ErrorResponse.handle(error, res);
    }
  }
}
