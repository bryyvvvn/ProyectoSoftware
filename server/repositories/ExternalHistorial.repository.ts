const BASE_URL = "https://puclaro.ucn.cl/eross/avance";

interface HistorialResponse {
  error?: string;
  [key: string]: unknown;
}

export type HistorialAPIResponse = HistorialResponse | unknown[];

/**
 * Cliente HTTP para el historial académico externo.
 */
export class ExternalHistorialAPI {
  /**
   * Recupera el historial académico para un estudiante.
   * @param rut RUT del estudiante
   * @param codcarrera Código de carrera
   */
  public static async fetchHistorial(rut: string, codcarrera: string): Promise<HistorialAPIResponse> {
    try {
      const url = `${BASE_URL}/avance.php?rut=${encodeURIComponent(rut)}&codcarrera=${encodeURIComponent(codcarrera)}`;
      const response = await fetch(url);
      const data: HistorialAPIResponse = await response.json();
      const errorMessage =
        !Array.isArray(data) && data?.error ? data.error : "Error al obtener el historial académico";

      if (!response.ok) {
        const error = new Error(errorMessage);
        (error as Error & { status?: number }).status = response.status === 404 ? 404 : 502;
        throw error;
      }

      if (!Array.isArray(data) && data?.error) {
        const error = new Error(data.error);
        (error as Error & { status?: number }).status = 404;
        throw error;
      }

      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Error desconocido obteniendo historial");
      (error as Error & { status?: number }).status = (error as Error & { status?: number }).status ?? 502;
      throw error;
    }
  }
}
