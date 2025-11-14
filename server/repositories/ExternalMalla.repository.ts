import { ExternalApiError } from "../utils/ErrorResponse";

const BASE_URL = "https://losvilos.ucn.cl/hawaii/api/mallas";

export class ExternalMallaRepository {
  static async fetchMalla(codigo: string, catalogo: string) {
    const query = `${codigo}-${catalogo}`;
    const url = `${BASE_URL}?${encodeURIComponent(query)}`;
    const apiKey = process.env.HAWAII_API_KEY || "jf400fejof13f";

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(url, {
        headers: { "X-HAWAII-AUTH": apiKey },
      });
    } catch (error) {
      throw new ExternalApiError("No se pudo obtener la malla desde la API externa", error);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      throw new ExternalApiError(
        `Error al consultar la malla: ${response.status} ${response.statusText}`,
        { status: response.status, body }
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ExternalApiError("La API de mallas retornó un formato inválido", error);
    }
  }
}
