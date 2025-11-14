import { ExternalAuthRepository } from "../repositories/ExternalAuth.repository";
import { HttpError } from "../utils/ErrorResponse";

export class AuthService {
  static async authenticate(username: string, password: string) {
    const response = await ExternalAuthRepository.login(username, password);

    if (!response || typeof response !== "object") {
      throw new HttpError(502, "Respuesta inválida de la API de autenticación");
    }

    if ((response as { error?: string }).error) {
      throw new HttpError(401, (response as { error: string }).error);
    }

    const usuario = (response as Record<string, unknown>).usuario || response;
    if (!usuario || typeof usuario !== "object") {
      throw new HttpError(500, "La API de autenticación no retornó datos de usuario válidos");
    }

    const extractField = (...keys: string[]) => {
      for (const key of keys) {
        const value = (usuario as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim().length) {
          return value.trim();
        }
      }
      return undefined;
    };

    const rut = extractField("rut", "studentRut", "student_rut", "usuario", "id");
    const nombre =
      extractField("nombre", "nombres", "nombre_completo", "fullname", "nombreCompleto") || (rut ?? "");
    const email = extractField("email", "correo", "correoInstitucional", "correoPersonal");
    const carrera = extractField("carrera", "codCarrera", "codigoCarrera", "carreraCodigo");

    if (!rut) {
      throw new HttpError(401, "No se pudo determinar el usuario autenticado");
    }

    return {
      rut,
      nombre,
      email: email ?? "",
      carrera: carrera ?? "",
      token: (response as Record<string, unknown>).token ?? (response as Record<string, unknown>).jwt ?? null,
    };
  }
}
