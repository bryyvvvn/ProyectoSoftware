import { Repository } from "typeorm";
import { Asignatura } from "../../entidades/Asignatura";
import { Proyeccion } from "../../entidades/Proyeccion";
import { ProyeccionAsignatura } from "../../entidades/Proyeccion_Asignatura";
import { ApiError } from "../../errors/ApiError";

type AssignmentWithCourse = ProyeccionAsignatura & { asignatura: Asignatura };

export type ProjectionSummary = Pick<Proyeccion, "id" | "nombreVersion" | "isIdeal">;

export class ProjectionService {
  constructor(
    private readonly proyeccionRepo: Repository<Proyeccion>,
    private readonly proyeccionAsignaturaRepo: Repository<ProyeccionAsignatura>
  ) {}

  async cloneProjection({ projectionId, nombreVersion }: { projectionId: number; nombreVersion?: string }): Promise<ProjectionSummary> {
    const original = await this.findProjectionWithAssignments(projectionId);
    const rutEstudiante = original.estudiante?.rut;
    if (!rutEstudiante) {
      throw ApiError.badRequest("La proyección no tiene estudiante asociado");
    }

    const finalName = await this.resolveProjectionName(rutEstudiante, nombreVersion);

    const nuevaProyeccion = this.proyeccionRepo.create({
      estudiante: original.estudiante,
      nombreVersion: finalName,
      isIdeal: false,
    });

    await this.proyeccionRepo.save(nuevaProyeccion);

    const assignments = this.getAssignmentsWithCourse(original).map((asignacion) =>
      this.proyeccionAsignaturaRepo.create({
        proyeccion: nuevaProyeccion,
        asignatura: asignacion.asignatura,
        estado: asignacion.estado,
        semestre: asignacion.semestre,
      })
    );

    if (assignments.length) {
      await this.proyeccionAsignaturaRepo.save(assignments);
    }

    return {
      id: nuevaProyeccion.id,
      nombreVersion: nuevaProyeccion.nombreVersion,
      isIdeal: nuevaProyeccion.isIdeal,
    };
  }

  private async findProjectionWithAssignments(id: number): Promise<Proyeccion> {
    const projection = await this.proyeccionRepo.findOne({
      where: { id },
      relations: { asignaturas: { asignatura: true }, estudiante: true },
    });

    if (!projection) {
      throw ApiError.notFound("Proyección no encontrada");
    }

    return projection;
  }

  private getAssignmentsWithCourse(proyeccion: Proyeccion): AssignmentWithCourse[] {
    return (proyeccion.asignaturas || []).filter(
      (asignacion): asignacion is AssignmentWithCourse =>
        asignacion.asignatura !== undefined && asignacion.asignatura !== null
    );
  }

  private async resolveProjectionName(rut: string, nombrePropuesto?: string) {
    if (nombrePropuesto && nombrePropuesto.trim().length) {
      const trimmed = nombrePropuesto.trim();
      await this.ensureNameIsAvailable(rut, trimmed);
      return trimmed;
    }

    const cantidad = await this.proyeccionRepo.count({ where: { estudiante: { rut } } });
    const generated = `v${cantidad + 1}`;
    await this.ensureNameIsAvailable(rut, generated);
    return generated;
  }

  private async ensureNameIsAvailable(rut: string, nombre: string) {
    const nombreExiste = await this.proyeccionRepo.findOne({
      where: { estudiante: { rut }, nombreVersion: nombre },
    });

    if (nombreExiste) {
      throw ApiError.conflict("Ya existe una versión con ese nombre");
    }
  }
}
