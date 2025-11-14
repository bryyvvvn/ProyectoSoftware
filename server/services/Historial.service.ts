import { ExternalHistorialRepository } from "../repositories/ExternalHistorial.repository";
import { HttpError } from "../utils/ErrorResponse";

export class HistorialService {
  static async obtenerHistorial(rut: string, codcarrera: string) {
    const data = await ExternalHistorialRepository.fetchHistorial(rut, codcarrera);

    if (!data || typeof data !== "object") {
      throw new HttpError(502, "La API de historial no entregó información válida");
    }

    if ((data as { error?: string }).error) {
      throw new HttpError(404, (data as { error: string }).error);
    }

    return data;
  }
}
