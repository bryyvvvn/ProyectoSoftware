import { ExternalHistorialAPI } from "../repositories/ExternalHistorial.repository";

export class HistorialService {
  static async obtenerHistorial(rut: string, codcarrera: string) {
    const data = await ExternalHistorialAPI.fetchHistorial(rut, codcarrera);

    if (!data || data.error) {
      const error = new Error(data?.error || "No se pudo obtener el historial académico");
      (error as any).statusCode = 404;
      throw error;
    }

    return data;
  }
}
