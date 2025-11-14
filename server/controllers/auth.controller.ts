import { Request, Response } from "express";
import { AuthService } from "../services/Auth.service";
import { ErrorResponse } from "../utils/ErrorResponse";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ error: "Faltan username o password" });
    }

    try {
      const userData = await AuthService.authenticate(username, password);
      return res.status(200).json(userData);
    } catch (error) {
      return ErrorResponse.handle(error, res);
    }
  }
}
