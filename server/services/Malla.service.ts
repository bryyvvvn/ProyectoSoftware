import { ExternalMallaAPI } from "../repositories/ExternalMalla.repository";

/**
 * Servicio con la lógica de negocio de las mallas académicas.
 */
export class MallaService {
  /**
   * Obtiene y normaliza la malla académica para los parámetros dados.
   * @param codigo Código de carrera
   * @param catalogo Catálogo asociado
   */
  public static async obtenerMalla(codigo: string, catalogo: string): Promise<unknown[]> {
    const mallaResponse = await ExternalMallaAPI.fetchMalla(codigo, catalogo);
    const cursos = Array.isArray(mallaResponse)
      ? (mallaResponse as unknown[])
      : (mallaResponse.malla as unknown[]) || (mallaResponse.data as unknown[]) || [];

    if (!Array.isArray(cursos)) {
      return [];
    }

    return cursos;
  }
}
