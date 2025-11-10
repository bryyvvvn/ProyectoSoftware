import "reflect-metadata"; // debe ir primero
import express from "express";
import cors from "cors";
import { AppDataSource } from "./db";
import { In } from 'typeorm';
import { Asignatura } from "./entidades/Asignatura";
import { Proyeccion } from "./entidades/Proyeccion";
import { ProyeccionAsignatura } from "./entidades/Proyeccion_Asignatura";
import { Estudiante } from "./entidades/Estudiante";

const app = express();
app.use(express.json());
app.use(cors());

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    //Para acceder a las tablas con la librería de TypeORM 
    const asignaturaRepo = AppDataSource.getRepository(Asignatura);
    const proyeccionRepo = AppDataSource.getRepository(Proyeccion);
    const proyeccionAsignaturaRepo = AppDataSource.getRepository(ProyeccionAsignatura);
    const estudianteRepo = AppDataSource.getRepository(Estudiante);

    const sanitizeString = (value: unknown) => {
      if (typeof value !== "string") return "";
      return value.trim();
    };

    const normalizeCodigo = (value: string) => sanitizeString(value).toUpperCase();

    const extractFirstNonEmpty = (...values: (unknown | undefined)[]) => {
      for (const value of values) {
        const sanitized = sanitizeString(value);
        if (sanitized.length) return sanitized;
      }
      return "";
    };

    const ensureEstudiantesFromLoginPayload = async (payload: any) => {
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
        const rut = extractFirstNonEmpty(
          fuente?.rut,
          fuente?.studentRut,
          fuente?.student_rut,
          payload?.rut,
          payload?.usuario?.rut
        );

        if (!rut) continue;

        const email =
          extractFirstNonEmpty(
            fuente?.email,
            fuente?.correo,
            fuente?.correoPersonal,
            fuente?.correoInstitucional,
            payload?.email,
            payload?.correo,
            payload?.usuario?.email
          ) || `${rut.replace(/[^0-9kK]/g, "")}@alumnos.ucn.cl`;

        const nombre =
          extractFirstNonEmpty(
            fuente?.nombre,
            fuente?.nombres,
            fuente?.nombreCompleto,
            fuente?.nombre_completo,
            fuente?.fullname,
            payload?.nombre,
            payload?.usuario?.nombre
          ) || rut;

        const existente = await estudianteRepo.findOne({ where: { rut } });
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
            await estudianteRepo.save(existente);
          }
        } else {
          const nuevo = estudianteRepo.create({
            rut,
            email,
            nombre,
          });
          await estudianteRepo.save(nuevo);
        }
      }
    };

    type AssignmentWithCourse = ProyeccionAsignatura & { asignatura: Asignatura };

    const ESTADOS_VALIDOS = ["cursado", "reprobado", "proyectado"] as const;

    const getAssignmentsWithCourse = (proyeccion: Proyeccion): AssignmentWithCourse[] =>
      (proyeccion.asignaturas || []).filter(
        (asig): asig is AssignmentWithCourse => asig.asignatura !== undefined && asig.asignatura !== null
      );

    const findProjectionById = async (id: number) =>
      proyeccionRepo.findOne({
        where: { id },
        relations: { asignaturas: { asignatura: true }, estudiante: true },
      });

    const creditsForSemester = (
      assignments: AssignmentWithCourse[],
      semester: number,
      ignoreAssignmentId?: number
    ) =>
      assignments
        .filter((assignment) => assignment.semestre === semester && assignment.id !== ignoreAssignmentId)
        .reduce((sum, assignment) => sum + assignment.asignatura.creditos, 0);

    const validatePrerequisites = (
      targetCourse: Asignatura,
      assignments: AssignmentWithCourse[],
      targetSemester?: number | null
    ): { ok: true } | { ok: false; message: string } => {
      const prereqs = targetCourse.prereq || [];
      if (!prereqs.length) return { ok: true };

      const missing = prereqs.filter((code) => {
        return !assignments.some((assignment) => {
          if (!assignment.asignatura || assignment.asignatura.codigo !== code) return false;
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
    };

    const buildProjectionMetrics = (proyeccion: Proyeccion) => {
      const assignments = getAssignmentsWithCourse(proyeccion);
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
    };

    // PLANIFICACIÓN ACADÉMICA
    app.get("/malla/:rut", async (req, res) => {
      const { rut } = req.params;
      const proyeccionIdParam = req.query.proyeccionId as string | undefined;

      try {
        const asignaturas = await asignaturaRepo.find();

        let proyeccion: Proyeccion | null = null;
        if (proyeccionIdParam) {
          const proyeccionId = Number.parseInt(proyeccionIdParam, 10);
          if (Number.isNaN(proyeccionId)) {
            return res.status(400).json({ error: "El parámetro proyeccionId debe ser numérico" });
          }

          const encontrada = await findProjectionById(proyeccionId);
          if (!encontrada) {
            return res.status(404).json({ error: "Proyección no encontrada" });
          }
          if (encontrada.estudiante?.rut !== rut) {
            return res.status(403).json({ error: "La proyección no pertenece al estudiante indicado" });
          }
          proyeccion = encontrada;
        } else {
          const proyecciones = await proyeccionRepo.find({
            where: { estudiante: { rut } },
            relations: { asignaturas: { asignatura: true }, estudiante: true },
            order: { isIdeal: "DESC", fechaCreacion: "DESC" },
          });
          proyeccion = proyecciones[0] || null;
        }

        const assignments = proyeccion ? getAssignmentsWithCourse(proyeccion) : [];
        const metrics = proyeccion ? buildProjectionMetrics(proyeccion) : null;
        const creditosPorSemestre = metrics?.creditosPorSemestre ?? {};

        const resultado = asignaturas.map((curso) => {
          const asignacion = assignments.find((a) => a.asignatura.codigo === curso.codigo);
          const motivos: string[] = [];
          let elegible = true;

          if (asignacion) {
            const prereqCheck = validatePrerequisites(
              curso,
              assignments.filter((a) => a.id !== asignacion.id),
              asignacion.semestre
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
            const prereqCheck = validatePrerequisites(curso, assignments, undefined);
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

        return res.json({
          proyeccionSeleccionada: proyeccion
            ? {
                id: proyeccion.id,
                nombreVersion: proyeccion.nombreVersion,
                isIdeal: proyeccion.isIdeal,
              }
            : null,
          asignaturas: resultado,
        });
      } catch (error) {
        console.error("Error al obtener malla interna:", error);
        return res.status(500).json({ error: "Error al obtener la malla del estudiante" });
      }
    });

    app.post("/proyecciones", async (req, res) => {
      const { rut, nombreVersion } = req.body as { rut?: string; nombreVersion?: string };
      const rutEstudiante = rut?.trim();

      if (!rutEstudiante) {
        return res.status(400).json({ error: "Debe indicar el RUT del estudiante" });
      }

      try {
        const estudiante = await estudianteRepo.findOne({ where: { rut: rutEstudiante } });
        if (!estudiante) {
          return res.status(404).json({ error: "Estudiante no encontrado" });
        }

        const nombrePropuesto = nombreVersion?.trim();
        const cantidadExistente = await proyeccionRepo.count({
          where: { estudiante: { rut: rutEstudiante } },
        });

        let nombreFinal = nombrePropuesto && nombrePropuesto.length ? nombrePropuesto : `v${cantidadExistente + 1}`;

        const nombreDuplicado = await proyeccionRepo.findOne({
          where: { estudiante: { rut: rutEstudiante }, nombreVersion: nombreFinal },
        });

        if (nombreDuplicado) {
          return res.status(409).json({ error: "Ya existe una versión con ese nombre" });
        }

        const nuevaProyeccion = proyeccionRepo.create({
          estudiante,
          nombreVersion: nombreFinal,
          isIdeal: false,
        });

        await proyeccionRepo.save(nuevaProyeccion);

        return res.status(201).json({
          message: "Proyección creada correctamente",
          proyeccion: {
            id: nuevaProyeccion.id,
            nombreVersion: nuevaProyeccion.nombreVersion,
            isIdeal: nuevaProyeccion.isIdeal,
          },
        });
      } catch (error) {
        console.error("Error al crear una nueva proyección:", error);
        return res.status(500).json({ error: "Error al crear la proyección" });
      }
    });

    app.post("/proyecciones/:id/asignaturas", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const body = req.body as {
        codigo?: string;
        semestre?: number;
        estado?: string;
        nombre?: string;
        creditos?: number;
        nivel?: number;
        catalogo?: string;
        prereq?: unknown;
      };

      const codigo = sanitizeString(body.codigo);
      const semestre = body.semestre;

      if (!codigo) {
        return res.status(400).json({ error: "Debe indicar el código de la asignatura" });
      }

      if (!Number.isInteger(semestre) || (semestre as number) < 1) {
        return res.status(400).json({ error: "Debe indicar un semestre válido (entero positivo)" });
      }

      const estado = body.estado;

      if (estado && !ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
        return res.status(400).json({ error: "Estado inválido para la asignatura" });
      }

      try {
        const proyeccion = await findProjectionById(proyeccionId);
        if (!proyeccion) return res.status(404).json({ error: "Proyección no encontrada" });

        const codigoNormalizado = normalizeCodigo(codigo);
        let asignatura = await asignaturaRepo.findOne({ where: { codigo } });
        if (!asignatura && codigoNormalizado !== codigo) {
          asignatura = await asignaturaRepo.findOne({ where: { codigo: codigoNormalizado } });
        }

        if (!asignatura) {
          const nombre = sanitizeString(body.nombre);
          const catalogo = sanitizeString(body.catalogo);
          const creditos = Number(body.creditos);
          const nivel = Number(body.nivel);
          const prereq = Array.isArray(body.prereq)
            ? body.prereq
                .map((item) => (typeof item === "string" ? normalizeCodigo(item) : ""))
                .filter((item) => item.length > 0)
            : [];

          if (!nombre || !catalogo || !Number.isFinite(creditos) || !Number.isFinite(nivel)) {
            return res.status(404).json({ error: "Asignatura no encontrada" });
          }

          const creditosEnteros = Math.max(0, Math.round(creditos));
          const nivelEntero = Math.max(0, Math.round(nivel));

          const nuevaAsignatura = asignaturaRepo.create({
            codigo: codigoNormalizado,
            nombre,
            creditos: creditosEnteros,
            nivel: nivelEntero,
            prereq: prereq.length ? prereq : null,
            catalogo,
          });

          asignatura = await asignaturaRepo.save(nuevaAsignatura);
        }

        const assignments = getAssignmentsWithCourse(proyeccion);
        if (assignments.some((a) => normalizeCodigo(a.asignatura.codigo) === codigoNormalizado)) {
          return res.status(409).json({ error: "La asignatura ya está en la proyección" });
        }

        const semestreNumero = semestre as number;

        const prereqCheck = validatePrerequisites(asignatura, assignments, semestreNumero);
        if (!prereqCheck.ok) {
          return res.status(400).json({ error: prereqCheck.message });
        }

        const creditosActuales = creditsForSemester(assignments, semestreNumero);
        if (creditosActuales + asignatura.creditos > 32) {
          return res.status(400).json({ error: "La operación supera el máximo de 32 créditos para el semestre indicado" });
        }

        const nuevaAsignacion = proyeccionAsignaturaRepo.create({
          proyeccion,
          asignatura,
          semestre: semestreNumero,
          estado: estado || "proyectado",
        });

        await proyeccionAsignaturaRepo.save(nuevaAsignacion);

        return res.status(201).json({
          message: "Asignatura agregada correctamente",
          asignacion: {
            id: nuevaAsignacion.id,
            codigo: asignatura.codigo,
            semestre: semestreNumero,
            estado: nuevaAsignacion.estado,
          },
        });
      } catch (error) {
        console.error("Error al agregar asignatura a la proyección:", error);
        return res.status(500).json({ error: "Error al guardar la asignatura en la proyección" });
      }
    });

    app.patch("/proyecciones/:id/asignaturas/:codigo", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      const { codigo } = req.params;
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const { semestre, estado } = req.body as { semestre?: number; estado?: string };

      if (semestre !== undefined && (!Number.isInteger(semestre) || semestre < 1)) {
        return res.status(400).json({ error: "Debe indicar un semestre válido (entero positivo)" });
      }

      if (estado && !ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
        return res.status(400).json({ error: "Estado inválido para la asignatura" });
      }

      try {
        const proyeccion = await findProjectionById(proyeccionId);
        if (!proyeccion) return res.status(404).json({ error: "Proyección no encontrada" });

        const assignments = getAssignmentsWithCourse(proyeccion);
        const asignacion = assignments.find((a) => a.asignatura.codigo === codigo);
        if (!asignacion) {
          return res.status(404).json({ error: "La asignatura no existe en la proyección" });
        }

        const nuevoSemestre = semestre ?? asignacion.semestre ?? undefined;
        if (nuevoSemestre === undefined) {
          return res
            .status(400)
            .json({ error: "Debe indicar un semestre para mover la asignatura o mantener el existente" });
        }

        const prereqCheck = validatePrerequisites(
          asignacion.asignatura,
          assignments.filter((a) => a.id !== asignacion.id),
          nuevoSemestre
        );
        if (!prereqCheck.ok) {
          return res.status(400).json({ error: prereqCheck.message });
        }

        const creditosNuevoSemestre = creditsForSemester(assignments, nuevoSemestre, asignacion.id);
        if (creditosNuevoSemestre + asignacion.asignatura.creditos > 32) {
          return res.status(400).json({ error: "La operación supera el máximo de 32 créditos para el semestre indicado" });
        }

        asignacion.semestre = nuevoSemestre;
        if (estado) asignacion.estado = estado;
        await proyeccionAsignaturaRepo.save(asignacion);

        return res.json({
          message: "Asignatura actualizada",
          asignacion: {
            codigo: asignacion.asignatura.codigo,
            semestre: asignacion.semestre,
            estado: asignacion.estado,
          },
        });
      } catch (error) {
        console.error("Error al actualizar asignatura de la proyección:", error);
        return res.status(500).json({ error: "Error al actualizar la asignatura" });
      }
    });

    app.delete("/proyecciones/:id/asignaturas/:codigo", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      const { codigo } = req.params;
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      try {
        const asignacion = await proyeccionAsignaturaRepo.findOne({
          where: { proyeccion: { id: proyeccionId }, asignatura: { codigo } },
          relations: { proyeccion: { estudiante: true }, asignatura: true },
        });

        if (!asignacion) {
          return res.status(404).json({ error: "La asignatura no se encuentra en la proyección" });
        }

        await proyeccionAsignaturaRepo.remove(asignacion);
        return res.json({ message: "Asignatura eliminada de la proyección" });
      } catch (error) {
        console.error("Error al eliminar asignatura de la proyección:", error);
        return res.status(500).json({ error: "Error al eliminar la asignatura" });
      }
    });

    app.post("/proyecciones/:id/clone", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const { nombreVersion } = req.body as { nombreVersion?: string };

      try {
        const original = await findProjectionById(proyeccionId);
        if (!original) return res.status(404).json({ error: "Proyección no encontrada" });

        const rutEstudiante = original.estudiante?.rut;
        if (!rutEstudiante) {
          return res.status(400).json({ error: "La proyección no tiene estudiante asociado" });
        }

        const nombrePropuesto = nombreVersion?.trim();
        let nombreFinal = nombrePropuesto;
        if (!nombreFinal) {
          const cantidad = await proyeccionRepo.count({ where: { estudiante: { rut: rutEstudiante } } });
          nombreFinal = `v${cantidad + 1}`;
        }

        const nombreExiste = await proyeccionRepo.findOne({
          where: { estudiante: { rut: rutEstudiante }, nombreVersion: nombreFinal },
        });
        if (nombreExiste) {
          return res.status(409).json({ error: "Ya existe una versión con ese nombre" });
        }

        const nuevaProyeccion = proyeccionRepo.create({
          estudiante: original.estudiante,
          nombreVersion: nombreFinal,
          isIdeal: false,
        });

        await proyeccionRepo.save(nuevaProyeccion);

        const assignments = getAssignmentsWithCourse(original).map((asignacion) =>
          proyeccionAsignaturaRepo.create({
            proyeccion: nuevaProyeccion,
            asignatura: asignacion.asignatura,
            estado: asignacion.estado,
            semestre: asignacion.semestre,
          })
        );

        if (assignments.length) {
          await proyeccionAsignaturaRepo.save(assignments);
        }

        return res.status(201).json({
          message: "Proyección clonada correctamente",
          proyeccion: {
            id: nuevaProyeccion.id,
            nombreVersion: nuevaProyeccion.nombreVersion,
            isIdeal: nuevaProyeccion.isIdeal,
          },
        });
      } catch (error) {
        console.error("Error al clonar la proyección:", error);
        return res.status(500).json({ error: "Error al clonar la proyección" });
      }
    });

    app.get("/proyecciones/:rut", async (req, res) => {
      const { rut } = req.params;

      try {
        const proyecciones = await proyeccionRepo.find({
          where: { estudiante: { rut } },
          relations: { asignaturas: { asignatura: true }, estudiante: true },
          order: { fechaCreacion: "ASC" },
        });

        if (!proyecciones.length) {
          return res.json({ proyecciones: [] });
        }

        const respuesta = proyecciones.map((proyeccion) => {
          const metrics = buildProjectionMetrics(proyeccion);
          return {
            id: proyeccion.id,
            nombreVersion: proyeccion.nombreVersion,
            isIdeal: proyeccion.isIdeal,
            fechaCreacion: proyeccion.fechaCreacion,
            totalCreditos: metrics.totalCreditos,
            cantidadSemestres: metrics.cantidadSemestres,
            creditosPorSemestre: metrics.creditosPorSemestre,
          };
        });

        return res.json({ proyecciones: respuesta });
      } catch (error) {
        console.error("Error al obtener proyecciones del estudiante:", error);
        return res.status(500).json({ error: "Error al obtener las proyecciones" });
      }
    });

    app.delete("/proyecciones/:id", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      try {
        const proyeccion = await proyeccionRepo.findOne({
          where: { id: proyeccionId },
          relations: { asignaturas: true },
        });

        if (!proyeccion) {
          return res.status(404).json({ error: "Proyección no encontrada" });
        }

        if (proyeccion.asignaturas?.length) {
          await proyeccionAsignaturaRepo.remove(proyeccion.asignaturas);
        }

        await proyeccionRepo.remove(proyeccion);

        return res.json({ message: "Proyección eliminada" });
      } catch (error) {
        console.error("Error al eliminar la proyección:", error);
        return res.status(500).json({ error: "Error al eliminar la proyección" });
      }
    });

    app.patch("/proyecciones/:id", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const { nombreVersion, isIdeal } = req.body as {
        nombreVersion?: string;
        isIdeal?: boolean;
      };

      if (!nombreVersion && typeof isIdeal !== "boolean") {
        return res
          .status(400)
          .json({ error: "Debe indicar un nuevo nombre de versión o el estado ideal de la proyección" });
      }

      try {
        const proyeccion = await proyeccionRepo.findOne({
          where: { id: proyeccionId },
          relations: { estudiante: true },
        });

        if (!proyeccion) {
          return res.status(404).json({ error: "Proyección no encontrada" });
        }

        if (nombreVersion) {
          const nombre = nombreVersion.trim();
          if (!nombre) {
            return res.status(400).json({ error: "El nombre de la versión no puede estar vacío" });
          }

          const existente = await proyeccionRepo.findOne({
            where: {
              estudiante: { rut: proyeccion.estudiante.rut },
              nombreVersion: nombre,
            },
          });

          if (existente && existente.id !== proyeccion.id) {
            return res.status(409).json({ error: "Ya existe otra versión con ese nombre" });
          }

          proyeccion.nombreVersion = nombre;
        }

        if (typeof isIdeal === "boolean") {
          proyeccion.isIdeal = isIdeal;
          if (isIdeal) {
            await proyeccionRepo
              .createQueryBuilder()
              .update(Proyeccion)
              .set({ isIdeal: false })
              .where("estudiante_rut = :rut AND id <> :id", {
                rut: proyeccion.estudiante.rut,
                id: proyeccion.id,
              })
              .execute();
          }
        }

        await proyeccionRepo.save(proyeccion);

        return res.json({
          message: "Proyección actualizada",
          proyeccion: {
            id: proyeccion.id,
            nombreVersion: proyeccion.nombreVersion,
            isIdeal: proyeccion.isIdeal,
          },
        });
      } catch (error) {
        console.error("Error al actualizar la proyección:", error);
        return res.status(500).json({ error: "Error al actualizar la proyección" });
      }
    });

    app.get("/proyecciones/compare", async (req, res) => {
      const idsParam = (req.query.ids as string | undefined) || "";
      const ids = idsParam
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => !Number.isNaN(value));

      if (ids.length < 2) {
        return res.status(400).json({ error: "Debe indicar al menos dos IDs de proyecciones a comparar" });
      }

      try {
        const proyecciones = await proyeccionRepo.find({
          where: { id: In(ids) },
          relations: { asignaturas: { asignatura: true }, estudiante: true },
        });

        if (proyecciones.length !== ids.length) {
          return res.status(404).json({ error: "No se encontraron todas las proyecciones solicitadas" });
        }

        const versiones = proyecciones.map((proyeccion) => {
          const metrics = buildProjectionMetrics(proyeccion);
          return {
            id: proyeccion.id,
            nombreVersion: proyeccion.nombreVersion,
            isIdeal: proyeccion.isIdeal,
            totalCreditos: metrics.totalCreditos,
            cantidadSemestres: metrics.cantidadSemestres,
          };
        });

        let comparacion: Record<string, unknown> | null = null;
        if (ids.length === 2) {
          const [idBase, idComparada] = ids;
          const base = proyecciones.find((p) => p.id === idBase)!;
          const comparada = proyecciones.find((p) => p.id === idComparada)!;

          const mapBase = new Map(
            getAssignmentsWithCourse(base).map((a) => [a.asignatura.codigo, a.semestre ?? null] as const)
          );
          const mapComparada = new Map(
            getAssignmentsWithCourse(comparada).map((a) => [a.asignatura.codigo, a.semestre ?? null] as const)
          );

          const soloBase = [...mapBase.keys()].filter((codigo) => !mapComparada.has(codigo));
          const soloComparada = [...mapComparada.keys()].filter((codigo) => !mapBase.has(codigo));

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
                    [String(idBase)]: semestreBase,
                    [String(idComparada)]: semestreComparada,
                  },
                });
              } else if (semestreComparada > semestreBase) {
                atrasadas.push({
                  codigo,
                  semestres: {
                    [String(idBase)]: semestreBase,
                    [String(idComparada)]: semestreComparada,
                  },
                });
              }
            }
          }

          comparacion = {
            baseId: idBase,
            comparadaId: idComparada,
            adelantadas,
            atrasadas,
            soloBase,
            soloComparada,
          };
        }

        return res.json({ versiones, comparacion });
      } catch (error) {
        console.error("Error al comparar proyecciones:", error);
        return res.status(500).json({ error: "Error al comparar las proyecciones" });
      }
    });


    // LOGIN
    app.post("/api/login", async (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Faltan username o password" });

      try {
        const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(401).json({ error: data.error });
        try{
          await ensureEstudiantesFromLoginPayload(data);

        } catch (persistError){
          console.error("No se pudo sincronizar el estudiante desde el login:", persistError)
        }
        return res.json(data);
      } catch (err) {
        console.error("Error en el proxy /api/login:", err);
        return res.status(500).json({ error: "Error en el servidor proxy" });
      }
    });

    // MALLA
    app.get("/api/malla/:codigo/:catalogo", async (req, res) => {
      const { codigo, catalogo } = req.params;
      try {
        const queryParam = `${codigo}-${catalogo}`;
        const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${encodeURIComponent(queryParam)}`;
        const response = await fetch(url, { headers: { "X-HAWAII-AUTH": "jf400fejof13f" } });
        const data = await response.json();
        const cursos = Array.isArray(data) ? data : data.malla || data.data || [];
        console.log("✅ Cursos enviados al frontend:", cursos.length);
        return res.json(cursos);
      } catch (err) {
        console.error("Error al obtener la malla:", err);
        return res.status(500).json({ error: "Error al obtener la malla" });
      }
    });

    // HISTORIAL
    app.get("/api/historial/:rut/:codcarrera", async (req, res) => {
      const { rut, codcarrera } = req.params;
      try {
        const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${encodeURIComponent(rut)}&codcarrera=${encodeURIComponent(codcarrera)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || data?.error) return res.status(404).json({ error: data?.error || "No se pudo obtener el historial académico" });
        console.log("✅ Registros de historial enviados:", Array.isArray(data) ? data.length : 0);
        res.json(data);
      } catch (err) {
        console.error("Error al obtener avance académico:", err);
        res.status(500).json({ error: "Error al obtener avance académico" });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`✅ Servidor escuchando en http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Error iniciando servidor con DB:", err);
  }
}

main();
