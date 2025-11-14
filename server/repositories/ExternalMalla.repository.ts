const BASE_URL = "https://losvilos.ucn.cl/hawaii/api";
const API_KEY = process.env.HAWAII_API_KEY || "jf400fejof13f";

interface MallaResponse {
  malla?: unknown[];
  data?: unknown[];
  [key: string]: unknown;
}

type MallaAPIResponse = MallaResponse | unknown[];

/**
 * Cliente HTTP para la API de mallas.
 */
export class ExternalMallaAPI {
  /**
   * Obtiene la malla académica desde el servicio externo.
   * @param codigo Código de carrera
   * @param catalogo Catálogo asociado
   */
  public static async fetchMalla(codigo: string, catalogo: string): Promise<MallaAPIResponse> {
    try {
      const query = `${codigo}-${catalogo}`;
      const url = `${BASE_URL}/mallas?${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "X-HAWAII-AUTH": API_KEY,
        },
      });
      const data: MallaAPIResponse = await response.json();

      if (!response.ok) {
        const error = new Error("Error al obtener la malla académica");
        (error as Error & { status?: number }).status = 502;
        throw error;
      }

      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Error desconocido consultando malla");
      (error as Error & { status?: number }).status = (error as Error & { status?: number }).status ?? 502;
      throw error;
    }
  }
}
