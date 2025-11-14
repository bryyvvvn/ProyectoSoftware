import { ExternalHistorialAPI, HistorialAPIResponse } from "../repositories/ExternalHistorial.repository";

interface HistorialResponse {
  error?: string;
  [key: string]: unknown;
}

/**
 * Servicio de lógica de negocio para el historial académico.
 */
export class HistorialService {
  /**
   * Obtiene el historial académico validando la respuesta.
   * @param rut RUT del estudiante
   * @param codcarrera Código de carrera
   */
  public static async obtenerHistorial(
    rut: string,
    codcarrera: string
  ): Promise<HistorialAPIResponse> {
    const historial = await ExternalHistorialAPI.fetchHistorial(rut, codcarrera);

    if (!historial) {
      const error = new Error("No se encontró historial académico");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    if (!Array.isArray(historial)) {
      const payload = historial as HistorialResponse;
      if (payload.error) {
        const error = new Error(payload.error);
        (error as Error & { status?: number }).status = 404;
        throw error;
      }
    }

    return historial;
  }
}
