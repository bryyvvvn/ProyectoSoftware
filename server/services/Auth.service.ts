import { ExternalAuthAPI } from "../repositories/ExternalAuth.repository";

export class AuthService {
  static async authenticate(username: string, password: string) {
    const data = await ExternalAuthAPI.login(username, password);

    if (!data || data.error) {
      const error = new Error(data?.error || "Credenciales inválidas");
      (error as any).statusCode = 401;
      throw error;
    }

    return data;
  }
}
