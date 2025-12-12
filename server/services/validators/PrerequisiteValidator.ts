import { Asignatura } from "../../entidades/Asignatura";
import { AssignmentWithCourse } from "../../types/AssignmentWithCourse"

export interface PrerequisiteValidator {
  validate(
    targetCourse: Asignatura,
    assignments: AssignmentWithCourse[],
    targetSemester?: number | null,
    approvedCourses?: Set<string>
  ): { ok: true } | { ok: false; message: string };
}

export class DefaultPrerequisiteValidator implements PrerequisiteValidator {
  constructor(private readonly normalizeCodigo: (value: string) => string) {}

  validate(
    targetCourse: Asignatura,
    assignments: AssignmentWithCourse[],
    targetSemester?: number | null,
    approvedCourses?: Set<string>
  ): { ok: true } | { ok: false; message: string } {
    const prereqs = Array.isArray(targetCourse.prereq)
      ? targetCourse.prereq.map((codigo) => this.normalizeCodigo(codigo)).filter(Boolean)
      : [];
    if (!prereqs.length) return { ok: true };

    const missing = prereqs.filter((code) => {
      const normalizedCode = this.normalizeCodigo(code);
      if (!normalizedCode) return false;
      if (approvedCourses?.has(normalizedCode)) return false;

      return !assignments.some((assignment) => {
        if (!assignment.asignatura) return false;
        const assignmentCode = this.normalizeCodigo(assignment.asignatura.codigo);
        if (assignmentCode !== normalizedCode) return false;
        if (assignment.estado === "cursado") return true;
        if (
          targetSemester !== undefined &&
          targetSemester !== null &&
          assignment.semestre !== null &&
          assignment.semestre !== undefined &&
          assignment.semestre < targetSemester &&
          assignment.estado !== "reprobado"
        ) {
          return true;
        }
        return false;
      });
    });

    if (missing.length) {
      return { ok: false, message: `Faltan prerrequisitos: ${missing.join(", ")}` };
    }

    return { ok: true };
  }
}