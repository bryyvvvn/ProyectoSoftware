import "reflect-metadata"; // debe ir primero
import express from "express";
import cors from "cors";
import { AppDataSource } from "./db";
import { RepositoryFactory, RepositoryFactoryPort } from "./repositories/RepositoryFactory";
import { AcademicPlanningService } from "./services/AcademicPlanningService";
import { HttpError } from "./errors/HttpError";

const app = express();
app.use(express.json());
app.use(cors());

const handleError = (res: express.Response, error: unknown, fallback: string) => {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

const parseNumericParam = (value: string | undefined, fieldName: string): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (Number.isNaN(parsed)) {
    throw new HttpError(400, `El parámetro ${fieldName} debe ser numérico`);
  }
  return parsed;
};

const executeWithErrorHandling = async (
  res: express.Response,
  fallbackMessage: string,
  operation: () => Promise<express.Response>
) => {
  try {
    return await operation();
  } catch (error) {
    return handleError(res, error, fallbackMessage);
  }
};

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    const repositoryFactory: RepositoryFactoryPort = new RepositoryFactory(AppDataSource);
    const planningService = new AcademicPlanningService(repositoryFactory);


    // PLANIFICACIÓN ACADÉMICA
    app.get("/malla/:rut", async (req, res) => {
      const { rut } = req.params;
      const carreraCodigoQuery = req.query.carrera as string | undefined;
      const catalogoQuery = req.query.catalogo as string | undefined;
      const approvedCourses = planningService.parseApprovedCodes(req.query.aprobadas);

      const proyeccionIdParam = req.query.proyeccionId as string | undefined;
      const proyeccionId =
        proyeccionIdParam && proyeccionIdParam.length > 0
          ? parseNumericParam(proyeccionIdParam, "proyeccionId")
          : undefined;

        return executeWithErrorHandling(res, "Error al obtener la malla del estudiante", async () => {
        const resultado = await planningService.getStudentCurriculum({
          rut,
          proyeccionId,
          carreraCodigo: carreraCodigoQuery,
          catalogo: catalogoQuery,
          approvedCourses,
        });
        return res.json(resultado);
      });
    });

    app.post("/proyecciones", async (req, res) =>
      executeWithErrorHandling(res, "Error al crear la proyección", async () => {
        const respuesta = await planningService.createProjection(req.body?.rut, req.body?.nombreVersion);
        return res.status(201).json(respuesta);
        })
    );

    app.post("/proyecciones/:id/asignaturas", async (req, res) => {
      const proyeccionId = parseNumericParam(req.params.id, "id de proyección");

      const approvedCourses = planningService.parseApprovedCodes(req.body?.aprobadas);

      return executeWithErrorHandling(
        res,
        "Error al guardar la asignatura en la proyección",
        async () => {
          const respuesta = await planningService.addCourseToProjection(proyeccionId, req.body, approvedCourses);
          return res.status(201).json(respuesta);
        }
      );
    });

    app.patch("/proyecciones/:id/asignaturas/:codigo", async (req, res) => {

      const proyeccionId = parseNumericParam(req.params.id, "id de proyección");
      const approvedCourses = planningService.parseApprovedCodes(req.body?.aprobadas);

      return executeWithErrorHandling(res, "Error al actualizar la asignatura", async () => {
        const respuesta = await planningService.updateAssignment(proyeccionId, req.params.codigo, req.body, approvedCourses);
        return res.json(respuesta);
      });
    });

    app.delete("/proyecciones/:id/asignaturas/:codigo", async (req, res) => {
      const proyeccionId = parseNumericParam(req.params.id, "id de proyección");

      return executeWithErrorHandling(res, "Error al eliminar la asignatura", async () => {
        const respuesta = await planningService.removeAssignment(proyeccionId, req.params.codigo);
        return res.json(respuesta);
      });
    });

    app.post("/proyecciones/:id/clone", async (req, res) => {
      const proyeccionId = parseNumericParam(req.params.id, "id de proyección");

      return executeWithErrorHandling(res, "Error al clonar la proyección", async () => {
        const respuesta = await planningService.cloneProjection(proyeccionId, req.body?.nombreVersion);
        return res.status(201).json(respuesta);
      });
    });

    app.get("/proyecciones/:rut", async (req, res) =>
      executeWithErrorHandling(res, "Error al obtener las proyecciones", async () => {
        const respuesta = await planningService.listProjections(req.params.rut);
        return res.json(respuesta);
      })
    );

    app.delete("/proyecciones/:id", async (req, res) => {
      const proyeccionId = parseNumericParam(req.params.id, "id de proyección");

      return executeWithErrorHandling(res, "Error al eliminar la proyección", async () => {
        const respuesta = await planningService.deleteProjection(proyeccionId);
        return res.json(respuesta);

      });
    });

    app.patch("/proyecciones/:id", async (req, res) => {
      const proyeccionId = parseNumericParam(req.params.id, "id de proyección");

      if (!req.body?.nombreVersion && typeof req.body?.isIdeal !== "boolean") {
        return res
          .status(400)
          .json({ error: "Debe indicar un nuevo nombre de versión o el estado ideal de la proyección" });
      }

      return executeWithErrorHandling(res, "Error al actualizar la proyección", async () => {
        const respuesta = await planningService.updateProjection(proyeccionId, req.body);
        return res.json(respuesta);
      });
    });

    app.get("/proyecciones/compare", async (req, res) => {
      const { rut } = req.query as { rut?: string };
      if (!rut) return res.status(400).json({ error: "Debe indicar el rut a comparar" });

      const baseId = req.query.baseId
        ? parseNumericParam(req.query.baseId as string, "baseId")
        : undefined;
      const comparadaId = req.query.comparadaId
        ? parseNumericParam(req.query.comparadaId as string, "comparadaId")
        : undefined;

      return executeWithErrorHandling(res, "Error al comparar las proyecciones", async () => {
        const respuesta = await planningService.compareProjections({
          rut,
          baseId,
          comparadaId,
        });

        return res.json(respuesta);
      });
    });


    // LOGIN
    app.post("/api/login", async (req, res) => {
      try {
        
        const data = await planningService.proxyLogin(req.body?.username, req.body?.password);
        return res.json(data);
      } catch (error) {
        return handleError(res, error, "Error en el servidor proxy");
      }
    });

    // MALLA
    app.get("/api/malla/:codigo/:catalogo", async (req, res) => {
      try {
        const lista = await planningService.fetchExternalMalla(req.params.codigo, req.params.catalogo);
        return res.json(lista);
      } catch (error) {
        return handleError(res, error, "Error al obtener la malla");
      }
    });

    // HISTORIAL
    app.get("/api/historial/:rut/:codcarrera", async (req, res) => {
      try {
        const data = await planningService.fetchHistorial(req.params.rut, req.params.codcarrera);
        return res.json(data);

      } catch (error) {
        return handleError(res, error, "Error al obtener avance académico");
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`✅ Servidor escuchando en http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Error iniciando servidor con DB:", err);
  }
}

main();