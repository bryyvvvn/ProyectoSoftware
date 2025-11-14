import { ExternalMallaRepository } from "../repositories/ExternalMalla.repository";
import { HttpError } from "../utils/ErrorResponse";

export class MallaService {
  static async obtenerMalla(codigo: string, catalogo: string) {
    const data = await ExternalMallaRepository.fetchMalla(codigo, catalogo);
    const cursos = Array.isArray(data) ? data : data?.malla || data?.data || [];

    if (!Array.isArray(cursos)) {
      throw new HttpError(502, "La API de mallas no retornó información válida");
    }

    return cursos;
  }
}
