import { ExternalApiError } from "../utils/ErrorResponse";

const BASE_URL = "https://puclaro.ucn.cl/eross/avance/avance.php";

export class ExternalHistorialRepository {
  static async fetchHistorial(rut: string, codcarrera: string) {
    const params = new URLSearchParams({ rut, codcarrera });
    const url = `${BASE_URL}?${params.toString()}`;

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new ExternalApiError("No se pudo contactar la API de historial académico", error);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      throw new ExternalApiError(
        `Error al consultar el historial: ${response.status} ${response.statusText}`,
        { status: response.status, body }
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ExternalApiError("La API de historial retornó datos inválidos", error);
    }
  }
}
