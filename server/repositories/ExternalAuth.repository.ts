const BASE_URL = "https://puclaro.ucn.cl/eross/avance";

interface AuthResponse {
  error?: string;
  [key: string]: unknown;
}

/**
 * Cliente para la API externa de autenticación.
 */
export class ExternalAuthAPI {
  /**
   * Realiza el login contra la API externa.
   * @param username Correo o nombre de usuario
   * @param password Contraseña del usuario
   */
  public static async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const url = `${BASE_URL}/login.php?email=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const response = await fetch(url);
      const data: AuthResponse = await response.json();

      if (!response.ok) {
        const error = new Error(data?.error || "Error al autenticar con el servicio externo");
        (error as Error & { status?: number }).status = response.status === 401 ? 401 : 502;
        throw error;
      }

      return data;
    } catch (err) {
      if (err instanceof Error && err.message === "Failed to fetch") {
        err.message = "No se pudo contactar el servicio de autenticación";
      }
      (err as Error & { status?: number }).status = (err as Error & { status?: number }).status ?? 502;
      throw err;
    }
  }
}
