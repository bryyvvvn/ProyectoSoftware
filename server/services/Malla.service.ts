import { ExternalMallaAPI } from "../repositories/ExternalMalla.repository";

export class MallaService {
  static async obtenerMalla(codigo: string, catalogo: string) {
    const data = await ExternalMallaAPI.fetchMalla(codigo, catalogo);
    const cursos = Array.isArray(data) ? data : data?.malla || data?.data || [];
    return Array.isArray(cursos) ? cursos : [];
  }
}
