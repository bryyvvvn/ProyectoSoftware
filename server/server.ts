import "reflect-metadata"; // debe ir primero
import express from "express";
import cors from "cors";
import { AppDataSource } from "./db";
import { RepositoryFactory } from "./repositories/RepositoryFactory";
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

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    const repositoryFactory = new RepositoryFactory(AppDataSource);
    const planningService = new AcademicPlanningService(repositoryFactory);


    // PLANIFICACIÓN ACADÉMICA
    app.get("/malla/:rut", async (req, res) => {
      const { rut } = req.params;
      const proyeccionIdParam = req.query.proyeccionId as string | undefined;
      const carreraCodigoQuery = req.query.carrera as string | undefined;
      const catalogoQuery = req.query.catalogo as string | undefined;
      const approvedCourses = planningService.parseApprovedCodes(req.query.aprobadas);

      const proyeccionId = proyeccionIdParam ? Number.parseInt(proyeccionIdParam, 10) : undefined;
      if (proyeccionIdParam && Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El parámetro proyeccionId debe ser numérico" });
      }

      try {
        const resultado = await planningService.getStudentCurriculum({
          rut,
          proyeccionId,
          carreraCodigo: carreraCodigoQuery,
          catalogo: catalogoQuery,
          approvedCourses,
        });
        return res.json(resultado);
      } catch (error) {
        return handleError(res, error, "Error al obtener la malla del estudiante");
      }
    });

    app.post("/proyecciones", async (req, res) => {
      try{
      const respuesta = await planningService.createProjection(req.body?.rut, req.body?.nombreVersion);
        return res.status(201).json(respuesta);
      } catch (error) {
        return handleError(res, error, "Error al crear la proyección");
      }
    });

    app.post("/proyecciones/:id/asignaturas", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);

      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const approvedCourses = planningService.parseApprovedCodes(req.body?.aprobadas);

      try {
        const respuesta = await planningService.addCourseToProjection(proyeccionId, req.body, approvedCourses);
        return res.status(201).json(respuesta);
      } catch (error) {
        return handleError(res, error, "Error al guardar la asignatura en la proyección");
      }
    });

    app.patch("/proyecciones/:id/asignaturas/:codigo", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const approvedCourses = planningService.parseApprovedCodes(req.body?.aprobadas);

      try {
        const respuesta = await planningService.updateAssignment(proyeccionId, req.params.codigo, req.body, approvedCourses);
        return res.json(respuesta);
      } catch (error) {
        return handleError(res, error, "Error al actualizar la asignatura");
      }
    });

    app.delete("/proyecciones/:id/asignaturas/:codigo", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);

      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      try {
        const respuesta = await planningService.removeAssignment(proyeccionId, req.params.codigo);
        return res.json(respuesta);

      } catch (error) {
        return handleError(res, error, "Error al eliminar la asignatura");
      }
    });

    app.post("/proyecciones/:id/clone", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }


      try {
        const respuesta = await planningService.cloneProjection(proyeccionId, req.body?.nombreVersion);
        return res.status(201).json(respuesta);

      } catch (error) {

        return handleError(res, error, "Error al clonar la proyección");
      }
    });

    app.get("/proyecciones/:rut", async (req, res) => {

      try {
  
        const respuesta = await planningService.listProjections(req.params.rut);
        return res.json(respuesta);

      } catch (error) {
        return handleError(res, error, "Error al obtener las proyecciones");

      }
    });

    app.delete("/proyecciones/:id", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      try {
        const respuesta = await planningService.deleteProjection(proyeccionId);
        return res.json(respuesta);

      } catch (error) {
        return handleError(res, error, "Error al eliminar la proyección");

      }
    });

    app.patch("/proyecciones/:id", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      if (!req.body?.nombreVersion && typeof req.body?.isIdeal !== "boolean") {
        return res
          .status(400)
          .json({ error: "Debe indicar un nuevo nombre de versión o el estado ideal de la proyección" });
      }

      try {
        const respuesta = await planningService.updateProjection(proyeccionId, req.body);
        return res.json(respuesta);

      } catch (error) {
        return handleError(res, error, "Error al actualizar la proyección");

      }
    });

    app.get("/proyecciones/compare", async (req, res) => {
      const { rut } = req.query as { rut?: string };
      if (!rut) return res.status(400).json({ error: "Debe indicar el rut a comparar" });

      const baseId = req.query.baseId ? Number.parseInt(req.query.baseId as string, 10) : undefined;
      const comparadaId = req.query.comparadaId ? Number.parseInt(req.query.comparadaId as string, 10) : undefined;

      try {
        const respuesta = await planningService.compareProjections({
          rut,
          baseId,
          comparadaId,
        });

        return res.json(respuesta);
      } catch (error) {
        return handleError(res, error, "Error al comparar las proyecciones");
      }
    });

    app.post("/proyecciones/:id/auto", async (req, res) => {
      const proyeccionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proyeccionId)) {
        return res.status(400).json({ error: "El id de proyección debe ser numérico" });
      }

      const approvedCourses = planningService.parseApprovedCodes(req.body?.aprobadas);
      
      // OPTIMIZACIÓN: Recibimos el catálogo del body
      const catalogo = req.body?.catalogo;

      try {
        // Pasamos el catálogo al servicio para que filtre
        const respuesta = await planningService.generateAutoProjection(proyeccionId, req.body?.rut, approvedCourses, catalogo);
        return res.status(200).json(respuesta);
      } catch (error) {
        return handleError(res, error, "Error al generar proyección automática");
      }
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