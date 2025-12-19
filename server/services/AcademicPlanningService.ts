import { Asignatura } from "../entidades/Asignatura";
import { Estudiante } from "../entidades/Estudiante";
import { Proyeccion } from "../entidades/Proyeccion";
import { ProyeccionAsignatura } from "../entidades/Proyeccion_Asignatura";
import { RepositoryFactory } from "../repositories/RepositoryFactory";
import { HttpError } from "../errors/HttpError";

type AssignmentWithCourse = ProyeccionAsignatura & { asignatura: Asignatura };

type CurriculumResult = {
  proyeccionSeleccionada: {
    id: number;
    nombreVersion: string;
    isIdeal: boolean;
  } | null;
  asignaturas: {
    codigo: string;
    nombre: string;
    creditos: number;
    nivel: number;
    prereq: string[];
    elegible: boolean;
    motivos: string[];
    asignado: { semestre: number | null; estado: string | null } | null;
  }[];
};

export class AcademicPlanningService {
  private readonly asignaturaRepo = this.repositoryFactory.createAsignaturaRepository();
  private readonly proyeccionRepo = this.repositoryFactory.createProyeccionRepository();
  private readonly proyeccionAsignaturaRepo = this.repositoryFactory.createProyeccionAsignaturaRepository();
  private readonly estudianteRepo = this.repositoryFactory.createEstudianteRepository();

  private readonly ESTADOS_VALIDOS = ["cursado", "reprobado", "proyectado"] as const;

  constructor(private readonly repositoryFactory: RepositoryFactory) {}

  // --- MÉTODO AGREGADO QUE FALTABA ---
  async createProjection(rut: string, nombreVersion?: string) {
    if (!rut) throw new HttpError(400, "El RUT es obligatorio");

    const estudiante = await this.estudianteRepo.findOne({ where: { rut } });
    if (!estudiante) throw new HttpError(404, "Estudiante no encontrado");

    const nombrePropuesto = nombreVersion?.trim();
    let nombreFinal = nombrePropuesto;

    if (!nombreFinal) {
      const cantidad = await this.proyeccionRepo.count({ where: { estudiante: { rut } } });
      nombreFinal = `Versión ${cantidad + 1}`;
    }

    // Verificar si el nombre ya existe
    const existente = await this.proyeccionRepo.findOne({
      where: { estudiante: { rut }, nombreVersion: nombreFinal },
    });

    if (existente) {
      // Si ya existe y fue generado automáticamente, le agregamos un timestamp
      if (!nombrePropuesto) {
        nombreFinal = `${nombreFinal} (${Date.now()})`;
      } else {
        throw new HttpError(409, "Ya existe una versión con ese nombre");
      }
    }

    const nuevaProyeccion = this.proyeccionRepo.create({
      estudiante,
      nombreVersion: nombreFinal,
      isIdeal: false,
      fechaCreacion: new Date(),
    });

    await this.proyeccionRepo.save(nuevaProyeccion);

    return {
      message: "Proyección creada exitosamente",
      proyeccion: {
        id: nuevaProyeccion.id,
        nombreVersion: nuevaProyeccion.nombreVersion,
        isIdeal: nuevaProyeccion.isIdeal,
      },
    };
  }
  // ----------------------------------

  async ensureEstudiantesFromLoginPayload(payload: any): Promise<void> {
    if (!payload || typeof payload !== "object") return;

    const posiblesFuentes: any[] = [];

    if (Array.isArray(payload.estudiantes)) posiblesFuentes.push(...payload.estudiantes);
    if (Array.isArray(payload.estudiante)) posiblesFuentes.push(...payload.estudiante);
    if (payload.estudiante && typeof payload.estudiante === "object" && !Array.isArray(payload.estudiante)) {
      posiblesFuentes.push(payload.estudiante);
    }

    if (!posiblesFuentes.length) {
      posiblesFuentes.push(payload);
    }

    for (const fuente of posiblesFuentes) {
      const rut = this.extractFirstNonEmpty(
        fuente?.rut,
        fuente?.studentRut,
        fuente?.student_rut,
        payload?.rut,
        payload?.usuario?.rut
      );

      if (!rut) continue;

      const email =
        this.extractFirstNonEmpty(
          fuente?.email,
          fuente?.correo,
          fuente?.correoPersonal,
          fuente?.correoInstitucional,
          payload?.email,
          payload?.correo,
          payload?.usuario?.email
        ) || `${rut.replace(/[^0-9kK]/g, "")}@alumnos.ucn.cl`;

      const nombre =
        this.extractFirstNonEmpty(
          fuente?.nombre,
          fuente?.nombres,
          fuente?.nombreCompleto,
          fuente?.nombre_completo,
          fuente?.fullname,
          payload?.nombre,
          payload?.usuario?.nombre
        ) || rut;

      const existente = await this.estudianteRepo.findOne({ where: { rut } });
      if (existente) {
        let actualizado = false;
        if (email && existente.email !== email) {
          existente.email = email;
          actualizado = true;
        }
        if (nombre && existente.nombre !== nombre) {
          existente.nombre = nombre;
          actualizado = true;
        }

        if (actualizado) {
          await this.estudianteRepo.save(existente);
        }
      } else {
        const nuevo = this.estudianteRepo.create({
          rut,
          email,
          nombre,
        });
        await this.estudianteRepo.save(nuevo);
      }
    }
  }

  parseApprovedCodes(input: unknown): Set<string> {
    const codes = new Set<string>();

    const process = (value: unknown) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach(process);
        return;
      }
      if (typeof value === "string") {
        value
          .split(/[;,]|\s+y\s+|\s+o\s+|\s*\+\s*|\s*\/\s*/i)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => {
            const normalized = this.toNormalizedCode(item);
            if (normalized) codes.add(normalized);
          });
        return;
      }
      if (typeof value === "number") {
        const normalized = this.toNormalizedCode(value);
        if (normalized) codes.add(normalized);
        return;
      }
      if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(process);
      }
    };

    process(input);
    return codes;
  }

  async getStudentCurriculum(params: {
    rut: string;
    proyeccionId?: number;
    carreraCodigo?: string;
    catalogo?: string;
    approvedCourses: Set<string>;
  }): Promise<CurriculumResult> {
    const { rut, proyeccionId, carreraCodigo, catalogo, approvedCourses } = params;

    const asignaturas = catalogo 
      ? await this.asignaturaRepo.find({ where: { catalogo } }) 
      : await this.asignaturaRepo.find();

    let proyeccion: Proyeccion | null = null;
    if (proyeccionId) {
      const encontrada = await this.findProjectionById(proyeccionId);
      if (!encontrada) {
        throw new HttpError(404, "Proyección no encontrada");
      }
      if (encontrada.estudiante?.rut !== rut) {
        throw new HttpError(403, "La proyección no pertenece al estudiante indicado");
      }
      proyeccion = encontrada;
    } else {
      const proyecciones = await this.proyeccionRepo.find({
        where: { estudiante: { rut } },
        relations: { asignaturas: { asignatura: true }, estudiante: true },
        order: { isIdeal: "DESC", fechaCreacion: "DESC" },
      });
      proyeccion = proyecciones[0] || null;
    }

    const assignments = proyeccion ? this.getAssignmentsWithCourse(proyeccion) : [];
    const metrics = proyeccion ? this.buildProjectionMetrics(proyeccion) : null;
    const creditosPorSemestre = metrics?.creditosPorSemestre ?? {};

    const resultado = asignaturas.map((curso) => {
      const asignacion = assignments.find((a) => a.asignatura.codigo === curso.codigo);
      
      const motivos: string[] = [];
      let elegible = true;

      if (asignacion) {
        const prereqCheck = this.validatePrerequisites(
          curso,
          assignments.filter((a) => a.id !== asignacion.id),
          asignacion.semestre,
          approvedCourses
        );
        if (!prereqCheck.ok) {
          motivos.push(prereqCheck.message);
        }

        if (asignacion.semestre !== null && asignacion.semestre !== undefined) {
          const total = creditosPorSemestre[asignacion.semestre] || 0;
          if (total > 32) {
            motivos.push(`Semestre ${asignacion.semestre} supera el límite de 32 créditos (${total})`);
          }
        }

        elegible = motivos.length === 0;
      } else {
        const prereqCheck = this.validatePrerequisites(curso, assignments, undefined, approvedCourses);
        if (!prereqCheck.ok) {
          motivos.push(prereqCheck.message);
          elegible = false;
        }
      }

      return {
        codigo: curso.codigo,
        nombre: curso.nombre,
        creditos: curso.creditos,
        nivel: curso.nivel,
        prereq: curso.prereq ?? [],
        elegible,
        motivos,
        asignado: asignacion
          ? {
              semestre: asignacion.semestre,
              estado: asignacion.estado,
            }
          : null,
      };
    });

    return {
      proyeccionSeleccionada: proyeccion
        ? {
            id: proyeccion.id,
            nombreVersion: proyeccion.nombreVersion,
            isIdeal: proyeccion.isIdeal,
          }
        : null,
      asignaturas: resultado,
    };
  }

  async addCourseToProjection(
    proyeccionId: number,
    body: {
      codigo?: string;
      semestre?: number;
      estado?: string;
      nombre?: string;
      creditos?: number;
      nivel?: number;
      catalogo?: string;
      prereq?: unknown;
    },
    approvedCourses: Set<string>
  ) {
    const proyeccion = await this.findProjectionById(proyeccionId);
    if (!proyeccion) throw new HttpError(404, "Proyección no encontrada");

    const codigo = this.sanitizeString(body.codigo);
    const semestre = body.semestre;

    if (!codigo) {
      throw new HttpError(400, "Debe indicar el código de la asignatura");
    }

    if (!Number.isInteger(semestre) || (semestre as number) < 1) {
      throw new HttpError(400, "Debe indicar un semestre válido (entero positivo)");
    }

    const estado = body.estado;

    if (estado && !this.ESTADOS_VALIDOS.includes(estado as (typeof this.ESTADOS_VALIDOS)[number])) {
      throw new HttpError(400, "Estado inválido para la asignatura");
    }

    const codigoNormalizado = this.normalizeCodigo(codigo);
    let asignatura = await this.asignaturaRepo.findOne({ where: { codigo } });
    if (!asignatura && codigoNormalizado !== codigo) {
      asignatura = await this.asignaturaRepo.findOne({ where: { codigo: codigoNormalizado } });
    }

    if (!asignatura) {
      const nombre = this.sanitizeString(body.nombre);
      const catalogo = this.sanitizeString(body.catalogo);
      const creditos = Number(body.creditos);
      const nivel = Number(body.nivel);
      const prereq = Array.isArray(body.prereq)
        ? body.prereq
            .map((item) => (typeof item === "string" ? this.normalizeCodigo(item) : ""))
            .filter((item) => item.length > 0)
        : [];

      if (!nombre || !catalogo || !Number.isFinite(creditos) || !Number.isFinite(nivel)) {
        throw new HttpError(404, "Asignatura no encontrada");
      }

      const creditosEnteros = Math.max(0, Math.round(creditos));
      const nivelEntero = Math.max(0, Math.round(nivel));

      const nuevaAsignatura = this.asignaturaRepo.create({
        codigo: codigoNormalizado,
        nombre,
        creditos: creditosEnteros,
        nivel: nivelEntero,
        prereq: prereq.length ? prereq : null,
        catalogo,
      });

      asignatura = await this.asignaturaRepo.save(nuevaAsignatura);
    }

    const assignments = this.getAssignmentsWithCourse(proyeccion);
    if (assignments.some((a) => this.normalizeCodigo(a.asignatura.codigo) === codigoNormalizado)) {
      throw new HttpError(409, "La asignatura ya está en la proyección");
    }

    const semestreNumero = semestre as number;

    const prereqCheck = this.validatePrerequisites(asignatura, assignments, semestreNumero, approvedCourses);
    if (!prereqCheck.ok) {
      throw new HttpError(400, prereqCheck.message);
    }

    const creditosActuales = this.creditsForSemester(assignments, semestreNumero);
    if (creditosActuales + asignatura.creditos > 32) {
      throw new HttpError(400, "La operación supera el máximo de 32 créditos para el semestre indicado");
    }

    const nuevaAsignacion = this.proyeccionAsignaturaRepo.create({
      proyeccion,
      asignatura,
      semestre: semestreNumero,
      estado: estado || "proyectado",
    });

    await this.proyeccionAsignaturaRepo.save(nuevaAsignacion);

    return {
      message: "Asignatura agregada correctamente",
      asignacion: {
        id: nuevaAsignacion.id,
        codigo: asignatura.codigo,
        semestre: semestreNumero,
        estado: nuevaAsignacion.estado,
      },
    };
  }

  async updateAssignment(
    proyeccionId: number,
    codigo: string,
    body: { semestre?: number; estado?: string },
    approvedCourses: Set<string>
  ) {
    const proyeccion = await this.findProjectionById(proyeccionId);
    if (!proyeccion) throw new HttpError(404, "Proyección no encontrada");

    const assignments = this.getAssignmentsWithCourse(proyeccion);
    const asignacion = assignments.find((a) => a.asignatura.codigo === codigo);
    if (!asignacion) {
      throw new HttpError(404, "La asignatura no existe en la proyección");
    }

    const nuevoSemestre = body.semestre ?? asignacion.semestre ?? undefined;
    if (nuevoSemestre === undefined) {
      throw new HttpError(400, "Debe indicar un semestre para mover la asignatura o mantener el existente");
    }

    if (body.semestre !== undefined && (!Number.isInteger(body.semestre) || body.semestre < 1)) {
      throw new HttpError(400, "Debe indicar un semestre válido (entero positivo)");
    }

    if (body.estado && !this.ESTADOS_VALIDOS.includes(body.estado as (typeof this.ESTADOS_VALIDOS)[number])) {
      throw new HttpError(400, "Estado inválido para la asignatura");
    }

    const prereqCheck = this.validatePrerequisites(
      asignacion.asignatura,
      assignments.filter((a) => a.id !== asignacion.id),
      nuevoSemestre,
      approvedCourses
    );
    if (!prereqCheck.ok) {
      throw new HttpError(400, prereqCheck.message);
    }

    const creditosNuevoSemestre = this.creditsForSemester(assignments, nuevoSemestre, asignacion.id);
    if (creditosNuevoSemestre + asignacion.asignatura.creditos > 32) {
      throw new HttpError(400, "La operación supera el máximo de 32 créditos para el semestre indicado");
    }

    asignacion.semestre = nuevoSemestre;
    if (body.estado) asignacion.estado = body.estado;
    await this.proyeccionAsignaturaRepo.save(asignacion);

    return {
      message: "Asignatura actualizada",
      asignacion: {
        codigo: asignacion.asignatura.codigo,
        semestre: asignacion.semestre,
        estado: asignacion.estado,
      },
    };
  }

  async removeAssignment(proyeccionId: number, codigo: string) {
    const asignacion = await this.proyeccionAsignaturaRepo.findOne({
      where: { proyeccion: { id: proyeccionId }, asignatura: { codigo } },
      relations: { proyeccion: { estudiante: true }, asignatura: true },
    });

    if (!asignacion) {
      throw new HttpError(404, "La asignatura no se encuentra en la proyección");
    }

    await this.proyeccionAsignaturaRepo.remove(asignacion);
    return { message: "Asignatura eliminada de la proyección" };
  }

  async cloneProjection(proyeccionId: number, nombreVersion?: string) {
    const original = await this.findProjectionById(proyeccionId);
    if (!original) throw new HttpError(404, "Proyección no encontrada");

    const rutEstudiante = original.estudiante?.rut;
    if (!rutEstudiante) {
      throw new HttpError(400, "La proyección no tiene estudiante asociado");
    }

    const nombrePropuesto = nombreVersion?.trim();
    let nombreFinal = nombrePropuesto;
    if (!nombreFinal) {
      const cantidad = await this.proyeccionRepo.count({ where: { estudiante: { rut: rutEstudiante } } });
      nombreFinal = `v${cantidad + 1}`;
    }

    const nombreExiste = await this.proyeccionRepo.findOne({
      where: { estudiante: { rut: rutEstudiante }, nombreVersion: nombreFinal },
    });
    if (nombreExiste) {
      throw new HttpError(409, "Ya existe una versión con ese nombre");
    }

    const nuevaProyeccion = this.proyeccionRepo.create({
      estudiante: original.estudiante,
      nombreVersion: nombreFinal,
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
      message: "Proyección clonada correctamente",
      proyeccion: {
        id: nuevaProyeccion.id,
        nombreVersion: nuevaProyeccion.nombreVersion,
        isIdeal: nuevaProyeccion.isIdeal,
      },
    };
  }

  async listProjections(rut: string) {
    const proyecciones = await this.proyeccionRepo.find({
      where: { estudiante: { rut } },
      relations: { asignaturas: { asignatura: true }, estudiante: true },
      order: { fechaCreacion: "ASC" },
    });

    return {
      proyecciones: proyecciones.map((proyeccion) => {
        const metrics = this.buildProjectionMetrics(proyeccion);
        return {
          id: proyeccion.id,
          nombreVersion: proyeccion.nombreVersion,
          isIdeal: proyeccion.isIdeal,
          fechaCreacion: proyeccion.fechaCreacion,
          totalCreditos: metrics.totalCreditos,
          cantidadSemestres: metrics.cantidadSemestres,
          creditosPorSemestre: metrics.creditosPorSemestre,
        };
      }),
    };
  }

  async deleteProjection(id: number) {
    const proyeccion = await this.proyeccionRepo.findOne({
      where: { id },
      relations: { asignaturas: true },
    });

    if (!proyeccion) {
      throw new HttpError(404, "Proyección no encontrada");
    }

    if (proyeccion.asignaturas?.length) {
      await this.proyeccionAsignaturaRepo.remove(proyeccion.asignaturas);
    }

    await this.proyeccionRepo.remove(proyeccion);

    return { message: "Proyección eliminada" };
  }

  async updateProjection(
    id: number,
    body: { nombreVersion?: string; isIdeal?: boolean | null }
  ) {
    const proyeccion = await this.proyeccionRepo.findOne({
      where: { id },
      relations: { estudiante: true },
    });

    if (!proyeccion) {
      throw new HttpError(404, "Proyección no encontrada");
    }

    if (body.nombreVersion) {
      const nombre = body.nombreVersion.trim();
      if (!nombre) {
        throw new HttpError(400, "El nombre de la versión no puede estar vacío");
      }

      const nombreExiste = await this.proyeccionRepo.findOne({
        where: { estudiante: { rut: proyeccion.estudiante?.rut }, nombreVersion: nombre },
      });

      if (nombreExiste && nombreExiste.id !== proyeccion.id) {
        throw new HttpError(409, "Ya existe otra versión con ese nombre");
      }

      proyeccion.nombreVersion = nombre;
    }

    if (typeof body.isIdeal === "boolean") {
      if (body.isIdeal) {
        await this.proyeccionRepo.update(
          { estudiante: { rut: proyeccion.estudiante?.rut } },
          { isIdeal: false }
        );
      }
      proyeccion.isIdeal = body.isIdeal;
    }

    await this.proyeccionRepo.save(proyeccion);

    return { message: "Proyección actualizada" };
  }

  async compareProjections(params: { rut: string; baseId?: number; comparadaId?: number }) {
    const { rut, baseId, comparadaId } = params;

    const proyecciones = await this.proyeccionRepo.find({
      where: { estudiante: { rut } },
      relations: { asignaturas: { asignatura: true } },
      order: { fechaCreacion: "ASC" },
    });

    const versiones = proyecciones.map((proyeccion) => ({
      id: proyeccion.id,
      nombreVersion: proyeccion.nombreVersion,
    }));

    let comparacion: {
      baseId: number;
      comparadaId: number;
      adelantadas: { codigo: string; semestres: Record<string, number | null> }[];
      atrasadas: { codigo: string; semestres: Record<string, number | null> }[];
      soloBase: string[];
      soloComparada: string[];
    } | null = null;

    if (baseId && comparadaId && baseId !== comparadaId) {
      const base = proyecciones.find((p) => p.id === baseId);
      const comparada = proyecciones.find((p) => p.id === comparadaId);

      if (!base || !comparada) {
        throw new HttpError(404, "No se pudieron encontrar las proyecciones para comparar");
      }

      const mapBase = new Map<string, number | null>();
      const mapComparada = new Map<string, number | null>();

      base.asignaturas?.forEach((asignacion) => {
        const key = asignacion.asignatura?.codigo || String(asignacion.id);
        mapBase.set(key, asignacion.semestre ?? null);
      });
      comparada.asignaturas?.forEach((asignacion) => {
        const key = asignacion.asignatura?.codigo || String(asignacion.id);
        mapComparada.set(key, asignacion.semestre ?? null);
      });

      const soloBase = Array.from(mapBase.keys()).filter((codigo) => !mapComparada.has(codigo));
      const soloComparada = Array.from(mapComparada.keys()).filter((codigo) => !mapBase.has(codigo));

      const adelantadas: { codigo: string; semestres: Record<string, number | null> }[] = [];
      const atrasadas: { codigo: string; semestres: Record<string, number | null> }[] = [];

      for (const codigo of mapBase.keys()) {
        if (!mapComparada.has(codigo)) continue;
        const semestreBase = mapBase.get(codigo);
        const semestreComparada = mapComparada.get(codigo);

        if (
          semestreBase !== null &&
          semestreBase !== undefined &&
          semestreComparada !== null &&
          semestreComparada !== undefined
        ) {
          if (semestreComparada < semestreBase) {
            adelantadas.push({
              codigo,
              semestres: {
                [String(baseId)]: semestreBase,
                [String(comparadaId)]: semestreComparada,
              },
            });
          } else if (semestreComparada > semestreBase) {
            atrasadas.push({
              codigo,
              semestres: {
                [String(baseId)]: semestreBase,
                [String(comparadaId)]: semestreComparada,
              },
            });
          }
        }
      }

      comparacion = {
        baseId,
        comparadaId,
        adelantadas,
        atrasadas,
        soloBase,
        soloComparada,
      };
    }

    return { versiones, comparacion };
  }

  async proxyLogin(username: string, password: string) {
    if (!username || !password) {
      throw new HttpError(400, "Faltan username o password");
    }

    const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw new HttpError(401, data.error);

    try {
      await this.ensureEstudiantesFromLoginPayload(data);
    } catch (persistError) {
      console.error("No se pudo sincronizar el estudiante desde el login:", persistError);
    }

    return data;
  }

  async fetchExternalMalla(codigo: string, catalogo: string) {
    const queryParam = `${codigo}-${catalogo}`;
    const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${encodeURIComponent(queryParam)}`;
    const response = await fetch(url, { headers: { "X-HAWAII-AUTH": "jf400fejof13f" } });
    const data = await response.json();
    const cursos = Array.isArray(data) ? data : data.malla || data.data || [];
    const lista = Array.isArray(cursos) ? cursos : [];
    
    // Ejecutamos la sincronización en segundo plano (sin await bloqueante) o la optimizamos
    // Aquí la dejaremos con await pero optimizada internamente
    await this.syncAsignaturasDesdeMalla(codigo, catalogo, lista).catch((error) =>
      console.error("No se pudo sincronizar la malla curricular durante la carga inicial:", error)
    );
    return lista;
  }

  async fetchHistorial(rut: string, codcarrera: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${encodeURIComponent(rut)}&codcarrera=${encodeURIComponent(
      codcarrera
    )}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || data?.error) {
      throw new HttpError(404, data?.error || "No se pudo obtener el historial académico");
    }
    return data;
  }

  private sanitizeString(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  private normalizeCodigo(value: string) {
    return this.sanitizeString(value).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  private extractNumericCode(value: string) {
    return this.sanitizeString(value).replace(/[^0-9]/g, "");
  }

  private extractFirstNonEmpty(...values: (unknown | undefined)[]) {
    for (const value of values) {
      const sanitized = this.sanitizeString(value);
      if (sanitized.length) return sanitized;
    }
    return "";
  }

  private toNormalizedCode(value: unknown): string {
    if (typeof value === "string") return this.normalizeCodigo(value);
    if (typeof value === "number") return this.normalizeCodigo(String(value));
    return "";
  }

  private extractPrerequisiteCodes(course: any): string[] {
    if (!course || typeof course !== "object") return [];

    const rawCandidates: unknown[] = [];
    for (const [key, value] of Object.entries(course)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("req")) {
        rawCandidates.push(value);
      }
    }

    const collected: string[] = [];

    const process = (value: unknown) => {
      if (!value && value !== 0) return;
      if (Array.isArray(value)) {
        value.forEach(process);
        return;
      }
      if (typeof value === "string") {
        const normalizedString = value
          .split(/[;,]|\s+y\s+|\s+o\s+|\s*\+\s*|\s*\/\s*/i)
          .map((item) => item.trim())
          .filter(Boolean);
        normalizedString.forEach((item) => {
          const normalized = this.toNormalizedCode(item);
          if (normalized && normalized !== "0") collected.push(normalized);
        });
        return;
      }
      if (typeof value === "number") {
        const normalized = this.toNormalizedCode(value);
        if (normalized && normalized !== "0") collected.push(normalized);
        return;
      }
      if (typeof value === "object") {
        const objectValue = value as Record<string, unknown>;
        if (typeof objectValue.codigo === "string" || typeof objectValue.codigo === "number") {
          const normalized = this.toNormalizedCode(objectValue.codigo);
          if (normalized && normalized !== "0") collected.push(normalized);
          return;
        }
        Object.values(objectValue).forEach(process);
      }
    };

    rawCandidates.forEach(process);

    return Array.from(new Set(collected));
  }

  private async syncAsignaturasDesdeMalla(
    codCarrera: string,
    catalogo: string,
    cursos?: unknown[]
  ): Promise<unknown[]> {
    const carreraCodigo = this.sanitizeString(codCarrera);
    const catalogoCodigo = this.sanitizeString(catalogo);
    if (!carreraCodigo || !catalogoCodigo) return Array.isArray(cursos) ? cursos : [];

    let cursosLista: unknown[] = Array.isArray(cursos) ? cursos : [];

    // Si no vienen cursos, intentamos bajarlos
    if (!cursosLista.length) {
      try {
        const queryParam = `${carreraCodigo}-${catalogoCodigo}`;
        const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${encodeURIComponent(queryParam)}`;
        const response = await fetch(url, { headers: { "X-HAWAII-AUTH": "jf400fejof13f" } });
        const data = await response.json();
        cursosLista = Array.isArray(data) ? data : data?.malla || data?.data || [];
        if (!Array.isArray(cursosLista)) cursosLista = [];
      } catch (syncError) {
        console.error("No se pudo sincronizar la malla curricular desde la API externa:", syncError);
        return Array.isArray(cursos) ? cursos : [];
      }
    }

    cursosLista = cursosLista.filter((curso: any) => {
        const codigo = curso.codigo || curso.CODIGO || curso.codAsignatura || "";
        return codigo.includes("-");
    });

    // 1. CARGA OPTIMIZADA: Solo cargamos los ramos de ESTE catálogo
    // Esto reduce la carga de miles de filas a unas pocas docenas.
    const relevantExisting = await this.asignaturaRepo.find({ where: { catalogo: catalogoCodigo } });
    const existingMap = new Map<string, Asignatura>();
    
    relevantExisting.forEach(a => {
        const num = this.extractNumericCode(a.codigo);
        if (num) existingMap.set(num, a);
    });

    const cursosNormalizados = cursosLista
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const objeto = raw as Record<string, unknown>;
        
        let codigoRaw = this.extractFirstNonEmpty(
              objeto.codigo, objeto.CODIGO, objeto.codAsignatura, objeto.cod_asignatura, objeto.cod, objeto.sigla
        );
        let codigo = this.normalizeCodigo(codigoRaw);
        
        // Magia Anti-Duplicados (Reutiliza si ya existe en este catálogo)
        const numKey = this.extractNumericCode(codigo);
        const existing = existingMap.get(numKey);
        if (existing) {
            codigo = existing.codigo;
        }

        const nombre = this.extractFirstNonEmpty(
            objeto.asignatura, objeto.nombre, objeto.nombre_asignatura, objeto.descripcion, objeto.title
          ) || codigo;
        const creditos = Number.parseInt(String(objeto.creditos ?? objeto.credito ?? objeto.credits ?? 0), 10);
        const nivel = Number.parseInt(String(objeto.nivel ?? objeto.level ?? objeto.semestre ?? 0), 10);
        
        const prereq = this.extractPrerequisiteCodes(objeto)
            .map((code) => {
                const pNum = this.extractNumericCode(code);
                const pExisting = existingMap.get(pNum);
                return pExisting ? pExisting.codigo : this.normalizeCodigo(code);
            })
            .filter(Boolean);

        if (!codigo || !nombre || Number.isNaN(creditos) || Number.isNaN(nivel)) return null;

        const prereqOrdenados = Array.from(new Set(prereq)).sort();

        return {
          codigo,
          nombre,
          creditos: Math.max(0, creditos),
          nivel: Math.max(0, nivel),
          prereq: prereqOrdenados,
          catalogo: catalogoCodigo,
        };
      })
      .filter((item): item is { codigo: string; nombre: string; creditos: number; nivel: number; prereq: string[]; catalogo: string } => item !== null);

    // 2. GUARDADO PARALELO: Usamos Promise.all para no bloquear el hilo
    const operations = cursosNormalizados.map(async (curso) => {
      const existente = existingMap.get(this.extractNumericCode(curso.codigo));
      
      if (!existente) {
        const nuevo = this.asignaturaRepo.create({
          codigo: curso.codigo,
          nombre: curso.nombre,
          creditos: curso.creditos,
          nivel: curso.nivel,
          prereq: curso.prereq.length ? curso.prereq : null,
          catalogo: curso.catalogo,
        });
        await this.asignaturaRepo.save(nuevo);
        // Actualizamos mapa local
        existingMap.set(this.extractNumericCode(nuevo.codigo), nuevo);
        return;
      }

      // Actualizar si cambió algo
      const updates: Partial<Asignatura> = {};
      if (existente.nombre !== curso.nombre) updates.nombre = curso.nombre;
      if (existente.creditos !== curso.creditos) updates.creditos = curso.creditos;
      if (existente.nivel !== curso.nivel) updates.nivel = curso.nivel;
      if (existente.catalogo !== curso.catalogo) updates.catalogo = curso.catalogo;

      const prereqActuales = Array.isArray(existente.prereq) ? existente.prereq : [];
      if (
        curso.prereq.length &&
        (prereqActuales.length !== curso.prereq.length ||
          prereqActuales.some((value, index) => value !== curso.prereq[index]))
      ) {
        updates.prereq = curso.prereq;
      }

      if (Object.keys(updates).length) {
        await this.asignaturaRepo.update(existente.codigo, updates);
      }
    });

    await Promise.all(operations);

    return cursosLista;
  }

  private getAssignmentsWithCourse(proyeccion: Proyeccion): AssignmentWithCourse[] {
    return (proyeccion.asignaturas || []).filter(
      (asig): asig is AssignmentWithCourse => asig.asignatura !== undefined && asig.asignatura !== null
    );
  }

  private findProjectionById(id: number) {
    return this.proyeccionRepo.findOne({
      where: { id },
      relations: { asignaturas: { asignatura: true }, estudiante: true },
    });
  }

  private creditsForSemester(assignments: AssignmentWithCourse[], semester: number, ignoreAssignmentId?: number) {
    return assignments
      .filter((assignment) => assignment.semestre === semester && assignment.id !== ignoreAssignmentId)
      .reduce((sum, assignment) => sum + assignment.asignatura.creditos, 0);
  }

  private validatePrerequisites(
    targetCourse: Asignatura,
    assignments: AssignmentWithCourse[],
    targetSemester?: number | null,
    approvedCourses?: Set<string>
  ): { ok: true } | { ok: false; message: string } {
    const prereqs = Array.isArray(targetCourse.prereq)
      ? targetCourse.prereq.map((codigo) => this.normalizeCodigo(codigo)).filter(Boolean)
      : [];
    
    if (!prereqs.length) return { ok: true };

    const missing: string[] = [];
    const timingErrors: string[] = [];

    for (const code of prereqs) {
      const normalizedCode = this.normalizeCodigo(code); 
      const numericCode = this.extractNumericCode(code); 

      if (!normalizedCode) continue;
      
      const isApproved = Array.from(approvedCourses || []).some(approved => 
          this.extractNumericCode(approved) === numericCode && numericCode.length > 2
      );
      if (isApproved) continue;

      const found = assignments.find((assignment) => {
        if (!assignment.asignatura) return false;
        return this.extractNumericCode(assignment.asignatura.codigo) === numericCode;
      });

      if (found) {
        if (found.estado === "reprobado") {
           missing.push(`${code} (Reprobado)`);
           continue;
        }
        
        if (targetSemester !== undefined && targetSemester !== null) {
          if (found.semestre !== null && found.semestre !== undefined) {
             if (found.semestre >= targetSemester) {
                timingErrors.push(`${code} (Tope: se cursa en semestre ${found.semestre})`);
             }
          }
        }
      } else {
        missing.push(code);
      }
    }

    if (targetSemester !== undefined && targetSemester !== null) {
       if (timingErrors.length > 0) {
          return { ok: false, message: `Error de orden: ${timingErrors.join(", ")}` };
       }
       return { ok: true };
    }

    if (timingErrors.length > 0 || missing.length > 0) {
       const allErrors = [...missing, ...timingErrors];
       return { ok: false, message: `Faltan prerrequisitos: ${allErrors.join(", ")}` };
    }

    return { ok: true };
  }

  private buildProjectionMetrics(proyeccion: Proyeccion) {
    const assignments = this.getAssignmentsWithCourse(proyeccion);
    const creditosPorSemestre: Record<number, number> = {};

    for (const assignment of assignments) {
      if (assignment.semestre !== null && assignment.semestre !== undefined) {
        creditosPorSemestre[assignment.semestre] =
          (creditosPorSemestre[assignment.semestre] || 0) + assignment.asignatura.creditos;
      }
    }

    const totalCreditos = assignments.reduce((sum, assignment) => sum + assignment.asignatura.creditos, 0);
    const cantidadSemestres = Object.keys(creditosPorSemestre).length;

    return { totalCreditos, cantidadSemestres, creditosPorSemestre };
  }

  async generateAutoProjection(proyeccionId: number, rut: string, externalApproved: Set<string> = new Set(), catalogo?: string) {
    const proyeccion = await this.findProjectionById(proyeccionId);
    if (!proyeccion) throw new HttpError(404, "Proyección no encontrada");

    const asignaturas = catalogo 
        ? await this.asignaturaRepo.find({ where: { catalogo } })
        : await this.asignaturaRepo.find();

    const currentAssignments = this.getAssignmentsWithCourse(proyeccion);
    
    const approvedNumerics = new Set<string>();
    externalApproved.forEach(code => approvedNumerics.add(this.extractNumericCode(code)));
    
    for (const assignment of currentAssignments) {
      if (assignment.estado === "cursado") {
        approvedNumerics.add(this.extractNumericCode(assignment.asignatura.codigo));
      }
    }

    const assignmentsToRemove = currentAssignments.filter(a => a.estado !== "cursado");
    if (assignmentsToRemove.length > 0) {
      await this.proyeccionAsignaturaRepo.remove(assignmentsToRemove);
    }

    const uniqueAsignaturasMap = new Map<string, Asignatura>();
    asignaturas.forEach(asig => {
        const num = this.extractNumericCode(asig.codigo);
        if (!num) return;
        const existing = uniqueAsignaturasMap.get(num);
        if (!existing || (asig.codigo.includes("-") && !existing.codigo.includes("-"))) {
            uniqueAsignaturasMap.set(num, asig);
        }
    });

    let pendingCourses = Array.from(uniqueAsignaturasMap.values())
        .filter(c => !approvedNumerics.has(this.extractNumericCode(c.codigo)));

    const plannedNumerics = new Set(approvedNumerics);
    
    const maxSemestreCursado = currentAssignments
      .filter(a => a.estado === "cursado")
      .reduce((max, a) => Math.max(max, a.semestre || 0), 0);
      
    let semesterCounter = maxSemestreCursado + 1;
    if (semesterCounter < 1) semesterCounter = 1;

    const newAssignments: any[] = [];
    const MAX_CREDITS = 32;
    const MAX_LOOPS = 60; 
    let loopCount = 0;

    while (pendingCourses.length > 0) {
      loopCount++;
      if (loopCount > MAX_LOOPS) break;

      let currentCredits = 0;
      const semesterSelection: Asignatura[] = [];

      let candidates = pendingCourses.filter(curso => {
        const prereqs = Array.isArray(curso.prereq) ? curso.prereq : [];
        return prereqs.every(req => plannedNumerics.has(this.extractNumericCode(req)));
      });

      candidates.sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel;
        return b.creditos - a.creditos;
      });

      for (const curso of candidates) {
        const cNum = this.extractNumericCode(curso.codigo);
        if (plannedNumerics.has(cNum)) continue;

        if (currentCredits + curso.creditos <= MAX_CREDITS) {
          semesterSelection.push(curso);
          currentCredits += curso.creditos;
          plannedNumerics.add(cNum);
        }
      }

      if (currentCredits < MAX_CREDITS) {
         const orphans = pendingCourses.filter(c => 
            !plannedNumerics.has(this.extractNumericCode(c.codigo)) && 
            c.nivel <= semesterCounter
         );
         orphans.sort((a, b) => a.nivel - b.nivel);

         for (const orphan of orphans) {
            const cNum = this.extractNumericCode(orphan.codigo);
            if (currentCredits + orphan.creditos <= MAX_CREDITS) {
               semesterSelection.push(orphan);
               currentCredits += orphan.creditos;
               plannedNumerics.add(cNum);
            }
         }
      }

      if (semesterSelection.length === 0 && pendingCourses.length > 0) {
         pendingCourses.sort((a, b) => a.nivel - b.nivel);
         const lowestLevel = pendingCourses[0].nivel;
         const forcedGroup = pendingCourses.filter(c => c.nivel === lowestLevel);

         for (const forced of forcedGroup) {
             const cNum = this.extractNumericCode(forced.codigo);
             if (plannedNumerics.has(cNum)) continue;

             if (currentCredits + forced.creditos <= MAX_CREDITS) {
                 semesterSelection.push(forced);
                 currentCredits += forced.creditos;
                 plannedNumerics.add(cNum);
             }
         }
      }

      for (const curso of semesterSelection) {
        newAssignments.push({
          proyeccion,
          asignatura: curso,
          semestre: semesterCounter,
          estado: "proyectado"
        });
        
        const cNum = this.extractNumericCode(curso.codigo);
        pendingCourses = pendingCourses.filter(p => this.extractNumericCode(p.codigo) !== cNum);
      }

      semesterCounter++;
    }

    if (newAssignments.length > 0) {
      const entities = this.proyeccionAsignaturaRepo.create(newAssignments);
      await this.proyeccionAsignaturaRepo.save(entities as any);
    }

    return { message: "Proyección optimizada generada exitosamente" };
  }

}