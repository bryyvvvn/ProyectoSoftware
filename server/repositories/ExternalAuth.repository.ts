import { ExternalApiError } from "../utils/ErrorResponse";

const BASE_URL = "https://puclaro.ucn.cl/eross/avance/login.php";

export class ExternalAuthRepository {
  static async login(username: string, password: string) {
    const params = new URLSearchParams({ username, password });
    const url = `${BASE_URL}?${params.toString()}`;

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(url, { method: "GET" });
    } catch (error) {
      throw new ExternalApiError("No se pudo conectar con la API de autenticación", error);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      throw new ExternalApiError(
        `Error al autenticar: ${response.status} ${response.statusText}`,
        { status: response.status, body }
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ExternalApiError("Respuesta inválida de la API de autenticación", error);
    }
  }
}
