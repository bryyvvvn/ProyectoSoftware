import { ExternalAuthAPI } from "../repositories/ExternalAuth.repository";

interface AuthResponse {
  error?: string;
  [key: string]: unknown;
}

/**
 * Servicio encargado de la lógica de autenticación.
 */
export class AuthService {
  /**
   * Autentica al usuario contra el proveedor externo.
   * @param username Nombre de usuario o correo
   * @param password Contraseña
   */
  public static async authenticate(username: string, password: string): Promise<AuthResponse> {
    const authResult = await ExternalAuthAPI.login(username, password);

    if (!authResult || authResult.error) {
      const error = new Error(authResult?.error || "Credenciales inválidas");
      (error as Error & { status?: number }).status = 401;
      throw error;
    }

    return authResult;
  }
}
