import React, { useCallback, useEffect, useMemo, useState } from "react";

interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

interface UserData {
  rut: string;
  carreras: Carrera[];
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000";

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const resolveLatestCareer = (carreras: Carrera[] = []) => {
  if (!carreras.length) return null;

  const toNumericCatalog = (catalogo: string) => {
    const digits = catalogo?.match(/\d+/g)?.join("") ?? "";
    const numeric = Number.parseInt(digits, 10);
    return Number.isNaN(numeric) ? null : numeric;
  };

  return carreras.reduce<Carrera>((latest, current) => {
    const latestValue = toNumericCatalog(latest.catalogo);
    const currentValue = toNumericCatalog(current.catalogo);

    if (latestValue === null && currentValue === null) {
      return current;
    }

    if (latestValue === null) return current;
    if (currentValue === null) return latest;

    if (currentValue === latestValue) return current;
    return currentValue > latestValue ? current : latest;
  }, carreras[0]);
};


type EstadoAsignatura = "cursado" | "reprobado" | "proyectado";

interface AsignacionInfo {
  semestre: number | null;
  estado: EstadoAsignatura;
}

interface HistorialRegistro {
  course: string;
  status: string;
  period?: string;
}

interface HistorialInfo {
  estado: EstadoAsignatura;
  etiqueta: string;
  periodo: string | null;
}

interface AsignaturaMalla {
  codigo: string;
  nombre: string;
  creditos: number;
  nivel: number;
  prereq: string[];
  elegible: boolean;
  motivos: string[];
  asignado: AsignacionInfo | null;
  historialEstado?: EstadoAsignatura | null;
  historialEtiqueta?: string | null;
  historialPeriodo?: string | null;
}

interface MallaResponse {
  proyeccionSeleccionada: {
    id: number;
    nombreVersion: string;
    isIdeal: boolean;
  } | null;
  asignaturas: AsignaturaMalla[];
}

interface CursoMallaBase {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
}

interface ProyeccionResumen {
  id: number;
  nombreVersion: string;
  isIdeal: boolean;
  fechaCreacion: string;
  totalCreditos: number;
  cantidadSemestres: number;
  creditosPorSemestre: Record<string, number>;
}

interface ProyeccionesResponse {
  proyecciones: ProyeccionResumen[];
}

type AlertKind = "success" | "error" | "info";

interface AlertState {
  id: number;
  type: AlertKind;
  text: string;
}

const normalizeEstadoAsignatura = (value: string | null | undefined): EstadoAsignatura | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["cursado", "aprobado"].includes(normalized)) return "cursado";
  if (["reprobado", "reprobada"].includes(normalized)) return "reprobado";
  if (["proyectado", "inscrito", "cursando", "en curso"].includes(normalized)) return "proyectado";
  return null;
};

const estadoLabels: Record<EstadoAsignatura, string> = {
  cursado: "Aprobado",
  reprobado: "Reprobado",
  proyectado: "Proyectado",
};

const estadoColorStyles: Record<EstadoAsignatura, string> = {
  cursado: "border-emerald-500 bg-emerald-100 text-emerald-900",
  reprobado: "border-red-500 bg-red-100 text-red-900",
  proyectado: "border-blue-500 bg-blue-100 text-blue-900",
};

const interpretHistorialStatus = (
  status: string | null | undefined
): { estado: EstadoAsignatura; etiqueta: string } | null => {
  if (!status) return null;
  const normalized = status.trim().toUpperCase();
  if (!normalized) return null;

  if (["APROBADO", "APROBADA", "CONVALIDADO", "CONVALIDADA", "RECONOCIDO"].includes(normalized)) {
    return { estado: "cursado", etiqueta: "Aprobado" };
  }

  if (["REPROBADO", "REPROBADA"].includes(normalized)) {
    return { estado: "reprobado", etiqueta: "Reprobado" };
  }

  if (["INSCRITO", "CURSANDO", "EN CURSO"].includes(normalized)) {
    return { estado: "proyectado", etiqueta: "Inscrito" };
  }

  return null;
};

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? "Error en la petición";
    throw new Error(message);
  }

  return data as T;
};

const formatCredits = (creditos: number) => `${creditos} créditos`;

const CourseCard: React.FC<{
  course: AsignaturaMalla;
  draggable?: boolean;
  onDragStart?: (codigo: string) => void;
  onDragEnd?: () => void;
  onChangeEstado?: (estado: EstadoAsignatura) => void;
}> = ({ course, draggable = true, onDragStart, onDragEnd}) => {
  const estadoActual = course.asignado?.estado ?? "proyectado";
  const historialEstado = course.historialEstado ?? null;
  const historialEtiqueta = course.historialEtiqueta ?? null;
  const historialPeriodo = course.historialPeriodo ?? null;
  const blocked = !course.elegible && !course.asignado && !historialEstado;
  const isAssigned = Boolean(course.asignado);
  const isApproved = historialEstado === "cursado" && !isAssigned;
  const assignedStyles = "border-blue-400 bg-blue-50 text-blue-900";
  const baseStyles = blocked
    ? "border-gray-400 bg-gray-200 text-gray-600"
    : isAssigned
    ? assignedStyles
    : historialEstado
    ? estadoColorStyles[historialEstado]
    : "border-slate-300 bg-white text-slate-900";
  const canDrag = draggable && (!blocked || isAssigned) && !isApproved;

  return (
    <div
      draggable={canDrag}
      onDragStart={(event) => {
        if (!canDrag) return;
        event.dataTransfer.setData("text/plain", course.codigo);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.(course.codigo);
      }}
      onDragEnd={onDragEnd}
      className={classNames(
        "rounded-lg border shadow-sm transition-shadow",
        "p-3 space-y-2",
        baseStyles,
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm tracking-tight">{course.codigo}</p>
          <p className="text-sm font-medium leading-tight">{course.nombre}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide">{formatCredits(course.creditos)}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">Nivel {course.nivel}</span>
        
        {!course.elegible && !course.asignado && (
          <span className="rounded-full bg-gray-300 px-2 py-0.5 text-gray-700">Bloqueado</span>
        )}
      </div>
      {(historialEtiqueta || historialPeriodo) && (
        <p className="text-xs font-medium text-current">
          Último registro: {historialEtiqueta ?? "—"}
          {historialPeriodo ? ` · ${historialPeriodo}` : ""}
        </p>
      )}

      {course.asignado && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">Semestre {course.asignado.semestre ?? "-"}</span>
        </div>
      )}

      {/* --- CÓDIGO NUEVO PARA LAS RESTRICCIONES --- */}
      {course.motivos.length > 0 && (
        <div className="group relative mt-2">
          {/* 1. El aviso pequeño visible siempre */}
          <div className="inline-flex w-fit cursor-help items-center gap-1 rounded-md bg-red-50 px-2 py-1.5 border border-red-100 transition-colors hover:bg-red-100">
             <span className="text-[10px] font-bold uppercase tracking-wider text-red-800">
               ⚠️ Restricciones ({course.motivos.length})
             </span>
          </div>

          {/* 2. El Tooltip flotante (aparece al pasar el mouse) */}
          <div className="absolute bottom-full left-0 z-30 mb-2 hidden w-[280px] rounded-lg border border-red-200 bg-white p-3 shadow-xl group-hover:block animate-in fade-in slide-in-from-bottom-2">
             <p className="mb-2 text-xs font-bold text-red-900">Detalle del bloqueo:</p>
             {/* Usamos max-h y overflow por si la lista es EXTREMADAMENTE larga */}
             <ul className="max-h-64 overflow-y-auto space-y-1.5 px-1">
              {course.motivos.map((motivo, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-[11px] leading-snug text-red-700 break-words text-left">
                  <span className="mt-0.5 text-red-400">•</span>
                  {/* Limpiamos el emoji si ya viene en el texto */}
                  <span>{motivo.replace('⚠️ ', '')}</span>
                </li>
              ))}
            </ul>
            {/* Un pequeño triángulo decorativo apuntando hacia abajo */}
            <div className="absolute -bottom-[5px] left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-red-200 bg-white"></div>
          </div>
        </div>
      )}
      {/* ------------------------------------------ */}
    </div>
  );
};

const SemesterColumn: React.FC<{
  semester: number;
  courses: AsignaturaMalla[];
  totalCredits: number;
  isActiveDrop: boolean;
  onDropCourse: (codigo: string, semestre: number) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDragStart: (codigo: string) => void;
  onDragEnd: () => void;
}> = ({
  semester,
  courses,
  totalCredits,
  isActiveDrop,
  onDropCourse,
  onDragOver,
  onDragLeave,
  onDragStart,
  onDragEnd,
}) => (
  <div
    className={classNames(
      "flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm transition",
      isActiveDrop ? "border-blue-500 bg-blue-50" : ""
    )}
    onDragOver={(event) => {
      event.preventDefault();
      onDragOver();
    }}
    onDragLeave={onDragLeave}
    onDrop={(event) => {
      event.preventDefault();
      const codigo = event.dataTransfer.getData("text/plain");
      if (codigo) onDropCourse(codigo, semester);
      onDragLeave();
    }}
  >
    <header className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Semestre {semester}</h3>
      <span className={classNames("text-xs font-semibold", totalCredits > 32 ? "text-red-600" : "text-slate-500")}> 
        {totalCredits} / 32 créditos
      </span>
    </header>
    <div className="flex flex-1 flex-col gap-3">
      {courses.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-400">
          Arrastra ramos aquí
        </p>
      ) : (
        [...courses]
          .sort((a, b) => a.codigo.localeCompare(b.codigo))
          .map((course) => (
            <CourseCard
              key={course.codigo}
              course={course}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
      )}
    </div>
  </div>
);

const CoursesPool: React.FC<{
  groupedCourses: Record<number, AsignaturaMalla[]>;
  activeLevel?: number | null;
  onDragStart: (codigo: string) => void;
  onDragEnd: () => void;
}> = ({ groupedCourses, activeLevel, onDragStart, onDragEnd }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Banco de cursos</h3>
      {typeof activeLevel === "number" && (
        <span className="text-xs font-semibold text-blue-600">Nivel {activeLevel}</span>
      )}
    </div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      {Object.keys(groupedCourses).length === 0 && (
        <p className="text-center text-xs text-slate-400">Todos los cursos están planificados 🎉</p>
      )}
      {Object.entries(groupedCourses)
        .sort(([nivelA], [nivelB]) => Number(nivelA) - Number(nivelB))
        .map(([nivel, cursos]) => (
          <div key={nivel} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Nivel {nivel}</span>
              <span className="text-xs text-slate-400">{cursos.length} ramos</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...cursos]
                .sort((a, b) => a.codigo.localeCompare(b.codigo))
                .map((curso) => (
                  <CourseCard
                    key={curso.codigo}
                    course={curso}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
            </div>
          </div>
        ))}
    </div>
  </div>
);

const RemovalDropZone: React.FC<{
  active: boolean;
  onDrop: (codigo: string) => void;
  onHoverChange: (value: boolean) => void;
}> = ({ active, onDrop, onHoverChange }) => (
  <div
    className={classNames(
      "flex items-center justify-center rounded-xl border-2 border-dashed p-4 text-sm font-semibold transition",
      active ? "border-red-500 bg-red-100 text-red-700" : "border-slate-300 bg-slate-100 text-slate-500"
    )}
    onDragOver={(event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      onHoverChange(true);
    }}
    onDragEnter={(event) => {
      event.preventDefault();
      onHoverChange(true);
    }}
    onDrop={(event) => {
      event.preventDefault();
      const codigo = event.dataTransfer.getData("text/plain");
      if (codigo) onDrop(codigo);
      onHoverChange(false);
    }}
    onDragLeave={() => onHoverChange(false)}
  >
    Soltar aquí para eliminar del semestre
  </div>
);

const ProyeccionesPage: React.FC<{ data: UserData }> = ({ data }) => {
  const [loadingMalla, setLoadingMalla] = useState(false);
  const [loadingProyecciones, setLoadingProyecciones] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const [courses, setCourses] = useState<AsignaturaMalla[]>([]);
  const [selectedProjection, setSelectedProjection] = useState<MallaResponse["proyeccionSeleccionada"]>(null);
  const [projections, setProjections] = useState<ProyeccionResumen[]>([]);
  const [draggingCourse, setDraggingCourse] = useState<string | null>(null);
  const [activeSemesterDrop, setActiveSemesterDrop] = useState<number | null>(null);
  const [removalActive, setRemovalActive] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState<Carrera | null>(resolveLatestCareer(data.carreras));

  useEffect(() => {
    setSelectedCareer(resolveLatestCareer(data.carreras));
  }, [data.carreras]);

  const selectedIdRef = React.useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedProjection?.id ?? null;
  }, [selectedProjection]);

  const showAlert = useCallback((type: AlertKind, text: string) => {
    setAlerts((prev) => [...prev, { id: Date.now(), type, text }]);
  }, []);

  useEffect(() => {
    if (!alerts.length) return;
    const timer = setTimeout(() => {
      setAlerts((prev) => prev.slice(1));
    }, 4000);

    return () => clearTimeout(timer);
  }, [alerts]);


  // Reemplaza tu función fetchProjections actual con esta:
  const fetchProjections = useCallback(async () => {
    setLoadingProyecciones(true);
    try {
      const params = new URLSearchParams();
      if (selectedCareer?.codigo) params.set("carrera", selectedCareer.codigo);
      if (selectedCareer?.catalogo) params.set("catalogo", selectedCareer.catalogo);

      const response = await fetchJson<ProyeccionesResponse>(
        `/proyecciones/${encodeURIComponent(data.rut)}${params.toString() ? `?${params.toString()}` : ""}`
      );
      setProjections(response.proyecciones);
      
      const availableIds = response.proyecciones.map((p) => p.id);
      const currentId = selectedIdRef.current; 

      // --- CAMBIO CLAVE AQUÍ ---
      // Si ya hay una ID seleccionada y es válida, NO HACEMOS NADA.
      if (currentId && availableIds.includes(currentId)) {
        setLoadingProyecciones(false);
        return; 
      }
      
      // Solo entramos aquí si NO hay nada seleccionado o la ID antigua fue borrada.
      if (!currentId) {
        if (response.proyecciones.length > 0) {
           // --- CAMBIO 2: PREFERIR LA MÁS NUEVA ---
           // Si no hay ideal, tomamos la última del array (la más reciente creada)
           const lista = response.proyecciones;
           const primera = lista.find((p) => p.isIdeal) ?? lista[lista.length - 1];
           
           setSelectedProjection({ id: primera.id, nombreVersion: primera.nombreVersion, isIdeal: primera.isIdeal });
        }
      } else if (!availableIds.includes(currentId)) {
        // La versión que veíamos fue borrada
        const siguiente = response.proyecciones[0] ?? null;
        setSelectedProjection(
          siguiente ? { id: siguiente.id, nombreVersion: siguiente.nombreVersion, isIdeal: siguiente.isIdeal } : null
        );
      }
      
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setLoadingProyecciones(false);
    }
  }, [data.rut, selectedCareer, showAlert]);

  const fetchMalla = useCallback(
    async (projectionId?: number | null) => {
      const carrera = selectedCareer;
      if (!data.rut || !carrera) return;
      
      setLoadingMalla(true);
 

      try {
        // ... (resto de tu código)
        const baseResponse = await fetch(
          `/api/malla/${encodeURIComponent(carrera.codigo)}/${encodeURIComponent(carrera.catalogo)}`
        );

        if (!baseResponse.ok) {
          throw new Error("No fue posible obtener la malla base del plan de estudios");
        }

        const baseCourses = (await baseResponse.json()) as CursoMallaBase[];
        const baseMap = new Map(baseCourses.map((course) => [course.codigo, course] as const));

        let historialRecords: HistorialRegistro[] = [];
        try {
          const registros = await fetchJson<HistorialRegistro[]>(
            `/api/historial/${encodeURIComponent(data.rut)}/${encodeURIComponent(carrera.codigo)}`
          );
          if (Array.isArray(registros)) {
            historialRecords = registros;
          } else {
            showAlert("info", "La respuesta del historial académico no es válida. Se omitirán estados previos.");
          }
        } catch (error) {
          console.error("No se pudo obtener el historial académico:", error);
          showAlert(
            "info",
            (error as Error).message ||
              "No se pudo obtener el historial académico. La malla se mostrará sin estados previos."
          );
        }

        const historialMap = new Map<string, HistorialInfo>();
        historialRecords
          .filter((record) => record && typeof record.course === "string")
          .sort((a, b) => (a.period ?? "").localeCompare(b.period ?? ""))
          .forEach((record) => {
            const interpreted = interpretHistorialStatus(record.status);
            const key = record.course?.trim().toUpperCase();
            if (!interpreted || !key) return;
            historialMap.set(key, {
              estado: interpreted.estado,
              etiqueta: interpreted.etiqueta,
              periodo: record.period ?? null,
            });
          });

        const aprobadasLista = Array.from(historialMap.entries())
          .filter(([, info]) => info.estado === "cursado")
          .map(([code]) => code);


        let projectionResponse: MallaResponse | null = null;
        try {
          const params = new URLSearchParams();
          if (projectionId) params.set("proyeccionId", String(projectionId));
          if (carrera.codigo) params.set("carrera", carrera.codigo);
          if (carrera.catalogo) params.set("catalogo", carrera.catalogo);
          if (aprobadasLista.length) params.set("aprobadas", aprobadasLista.join(","));
          // ... dentro de fetchMalla ...
          const url = `/malla/${encodeURIComponent(data.rut)}${params.toString() ? `?${params.toString()}` : ""}`;
          projectionResponse = await fetchJson<MallaResponse>(url);

          // --- CAMBIO 1: SOLO ACTUALIZAR SI SE PIDIÓ UNA ID ---
          // Si projectionId es undefined (carga inicial), ignoramos lo que sugiera el servidor
          // para que sea fetchProjections quien decida cual mostrar.
          if (projectionId && projectionResponse.proyeccionSeleccionada) {
             setSelectedProjection(projectionResponse.proyeccionSeleccionada);
          }
          // -----------------------------------------------------
          
        } catch (error) {
          console.error(error);
          showAlert("error", (error as Error).message);
        }

        const projectionMap = new Map<string, AsignaturaMalla>();
        projectionResponse?.asignaturas.forEach((course) => {
          const normalizedAssignedState = normalizeEstadoAsignatura(course.asignado?.estado);
          const normalizedHistorialState = normalizeEstadoAsignatura(course.historialEstado);
          projectionMap.set(course.codigo, {
            ...course,
            asignado: course.asignado
              ? { ...course.asignado, estado: normalizedAssignedState ?? course.asignado.estado ?? "proyectado" }
              : null,
            prereq: Array.isArray(course.prereq) ? course.prereq : [],
            motivos: Array.isArray(course.motivos) ? course.motivos : course.motivos ? [course.motivos] : [],
            historialEstado: normalizedHistorialState,
            historialEtiqueta: course.historialEtiqueta ?? null,
            historialPeriodo: course.historialPeriodo ?? null,
          });
        });

        const combined: AsignaturaMalla[] = baseCourses.map((course) => {
          const courseCode = course.codigo.toUpperCase();
          const projectionInfo = projectionMap.get(course.codigo);
          const historialInfo = historialMap.get(courseCode) ?? null;

          if (projectionInfo) {
            projectionMap.delete(course.codigo);
            return {
              ...projectionInfo,
              asignado: projectionInfo.asignado
                ? {
                    ...projectionInfo.asignado,
                    estado:
                      normalizeEstadoAsignatura(projectionInfo.asignado.estado) ??
                      projectionInfo.asignado.estado ??
                      "proyectado",
                  }
                : null,
              nombre: course.asignatura,
              creditos: course.creditos,
              nivel: Number(course.nivel),
              prereq: Array.isArray(projectionInfo.prereq) ? projectionInfo.prereq : [],
              motivos: Array.isArray(projectionInfo.motivos)
                ? projectionInfo.motivos
                : projectionInfo.motivos
                ? [projectionInfo.motivos]
                : [],
              historialEstado:
                historialInfo?.estado ??
                normalizeEstadoAsignatura(projectionInfo.historialEstado) ??
                null,
              historialEtiqueta: historialInfo?.etiqueta ?? projectionInfo.historialEtiqueta ?? null,
              historialPeriodo: historialInfo?.periodo ?? projectionInfo.historialPeriodo ?? null,
            };
          }

          return {
            codigo: course.codigo,
            nombre: course.asignatura,
            creditos: course.creditos,
            nivel: Number(course.nivel),
            prereq: [],
            elegible: true,
            motivos: [],
            asignado: null,
            historialEstado: historialInfo?.estado ?? null,
            historialEtiqueta: historialInfo?.etiqueta ?? null,
            historialPeriodo: historialInfo?.periodo ?? null,
          };
        });

        projectionMap.forEach((course, codigo) => {
          const base = baseMap.get(codigo);
          if (!base) return;
          const historialInfo = historialMap.get(codigo.toUpperCase()) ?? null;
          const normalizedAssignedState = normalizeEstadoAsignatura(course.asignado?.estado);
          const normalizedHistorialState = normalizeEstadoAsignatura(course.historialEstado);
          combined.push({
            ...course,
            asignado: course.asignado
              ? { ...course.asignado, estado: normalizedAssignedState ?? course.asignado.estado ?? "proyectado" }
              : null,
            prereq: Array.isArray(course.prereq) ? course.prereq : [],
            motivos: Array.isArray(course.motivos) ? course.motivos : course.motivos ? [course.motivos] : [],
            nombre: course.nombre ?? base?.asignatura ?? course.codigo,
            creditos: course.creditos ?? base?.creditos ?? 0,
            nivel: Number(course.nivel ?? base?.nivel ?? 0),
            historialEstado: historialInfo?.estado ?? normalizedHistorialState ?? null,
            historialEtiqueta: historialInfo?.etiqueta ?? course.historialEtiqueta ?? null,
            historialPeriodo: historialInfo?.periodo ?? course.historialPeriodo ?? null,
          });
        });

        setCourses(combined);
      } catch (error) {
        console.error(error);
        showAlert("error", (error as Error).message);
        setCourses([]);
      } finally {
        setLoadingMalla(false);
      }
    },
    [data.rut, selectedCareer, showAlert]
  );

  useEffect(() => {
    setSelectedProjection(null);
    selectedIdRef.current = null;
    setCourses([]);
  }, [selectedCareer]);

  useEffect(() => {
    fetchProjections();
  }, [fetchProjections]);

  useEffect(() => {
    fetchMalla(selectedProjection?.id);
  }, [fetchMalla, selectedProjection?.id]);

  const planningCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          normalizeEstadoAsignatura(course.historialEstado) !== "cursado" &&
          normalizeEstadoAsignatura(course.asignado?.estado) !== "cursado"
      ),
    [courses]
  );

  const assignedBySemester = useMemo(() => {
    const map = new Map<number, AsignaturaMalla[]>();
    const totals = new Map<number, number>();
    planningCourses
      .filter((course) => course.asignado?.semestre)
      .forEach((course) => {
        const semestre = course.asignado!.semestre!;
        const list = map.get(semestre) ?? [];
        list.push(course);
        map.set(semestre, list);
        totals.set(semestre, (totals.get(semestre) ?? 0) + course.creditos);
      });
    return { map, totals };
  }, [planningCourses]);

  // En Proyecciones.tsx

  // En Proyecciones.tsx

  // En Proyecciones.tsx

  const unassignedByLevel = useMemo(() => {
    // Helper local para extraer solo números (Ignora letras y guiones)
    const getNum = (str: string) => str.replace(/[^0-9]/g, "");

    // 1. Creamos una "Lista Negra" de números ocupados
    const unavailableNumerics = new Set<string>();

    planningCourses.forEach((c) => {
      // Si el ramo está asignado (proyectado) O ya está aprobado (historial)
      if (c.asignado?.semestre || c.historialEstado === "cursado") {
        unavailableNumerics.add(getNum(c.codigo));
      }
    });

    const grouped: Record<number, AsignaturaMalla[]> = {};
    
    planningCourses
      .filter((course) => {
        const myNum = getNum(course.codigo);
        
        // FILTRO DEFINITIVO:
        // Si el número de este curso ya está en la lista negra, LO ESCONDEMOS.
        // Esto hace que SSED00102 esconda a DDOC00102, y DCCB-00141 esconda a DCCB00141.
        const isAlreadyPresent = unavailableNumerics.has(myNum);

        return !isAlreadyPresent;
      })
      .forEach((course) => {
        if (!grouped[course.nivel]) grouped[course.nivel] = [];
        grouped[course.nivel].push(course);
      });
      
    return grouped;
  }, [planningCourses]);

  const maxSemester = useMemo(() => {
    const semestres = Array.from(assignedBySemester.map.keys());
    const niveles = planningCourses.map((course) => Number(course.nivel) || 0);
    const maxDetected = Math.max(0, ...semestres, ...(niveles.length ? niveles : [0]));
    return Math.max(1, maxDetected);
  }, [assignedBySemester.map, planningCourses]);

  const approvedCourseCodes = useMemo(() => {
    const codes = new Set<string>();
    courses.forEach((course) => {
      const historialEstado = normalizeEstadoAsignatura(course.historialEstado);
      const asignadoEstado = normalizeEstadoAsignatura(course.asignado?.estado);
      if (historialEstado === "cursado" || asignadoEstado === "cursado") {
        codes.add(course.codigo.toUpperCase());
      }
    });
    return Array.from(codes);
  }, [courses]);

  // En Proyecciones.tsx

  // En Proyecciones.tsx

  const handleAutoProjection = async () => {
    if (!selectedProjection?.id) return;
    const confirm = window.confirm("Esto reordenará todos los ramos futuros automáticamente. ¿Continuar?");
    if (!confirm) return;

    try {
      setSaving(true);
      // 1. Ejecutar la proyección en el servidor
      await fetchJson(`/proyecciones/${selectedProjection.id}/auto`, {
        method: "POST",
        body: JSON.stringify({ 
          rut: data.rut, 
          aprobadas: approvedCourseCodes 
        }),
      });
      
      showAlert("success", "✨ Proyección automática generada");

      // 2. TRUCO VISUAL: Limpiar el estado local momentáneamente
      // Esto obliga a React a "olvidar" los datos viejos antes de traer los nuevos.
      setCourses([]); 

      // 3. Recargar los datos frescos del servidor
      await Promise.all([
          fetchMalla(selectedProjection.id), 
          fetchProjections()
      ]);
      
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDropToSemester = async (codigo: string, semestre: number) => {
    if (!selectedProjection?.id) {
      showAlert("info", "Selecciona una versión para modificar la planificación");
      return;
    }

    const course = courses.find((item) => item.codigo === codigo);
    if (!course) return;

    if (course.asignado && course.asignado.semestre === semestre) {
      setRemovalActive(false);
      setDraggingCourse(null);
      return;
    }

    try {
      setSaving(true);
      if (course.asignado) {
        await fetchJson(`/proyecciones/${selectedProjection.id}/asignaturas/${encodeURIComponent(codigo)}`, {
          method: "PATCH",
          body: JSON.stringify({ semestre, aprobadas: approvedCourseCodes }),
        });
      } else {
        const carreraPrincipal = selectedCareer;
        const payload = {
          codigo,
          semestre,
          nombre: course.nombre,
          creditos: course.creditos,
          nivel: course.nivel,
          catalogo: carreraPrincipal?.catalogo ?? "GENERAL",
          prereq: Array.isArray(course.prereq) ? course.prereq : [],
          aprobadas: approvedCourseCodes,
        };
        await fetchJson(`/proyecciones/${selectedProjection.id}/asignaturas`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setRemovalActive(false);
      showAlert("success", "Cambios guardados automáticamente");
      await Promise.all([fetchMalla(selectedProjection.id), fetchProjections()]);
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
      setDraggingCourse(null);
      setRemovalActive(false);
    }
  };

  const handleRemoveCourse = async (codigo: string) => {
    if (!selectedProjection?.id) return;
    const course = courses.find((item) => item.codigo === codigo);
    if (!course?.asignado) return;
    try {
      setSaving(true);
      await fetchJson(`/proyecciones/${selectedProjection.id}/asignaturas/${encodeURIComponent(codigo)}`, {
        method: "DELETE",
      });
      showAlert("success", "Asignatura eliminada del semestre");
      await Promise.all([fetchMalla(selectedProjection.id), fetchProjections()]);
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
      setDraggingCourse(null);
      setRemovalActive(false);
    }
  };

  const handleSelectProjection = (id: number) => {
    const projection = projections.find((p) => p.id === id);
    if (!projection) return;
    setSelectedProjection({ id: projection.id, nombreVersion: projection.nombreVersion, isIdeal: projection.isIdeal });
  };

  const handleCreateProjection = async () => {
    if (!data.rut) {
      showAlert("error", "No se pudo determinar el estudiante para crear la planificación");
      return;
    }

    const nombreVersion = window.prompt("Nombre para la nueva planificación (opcional)")?.trim();

    try {
      setSaving(true);
      const response = await fetchJson<{
        proyeccion: { id: number; nombreVersion: string; isIdeal: boolean };
      }>(`/proyecciones`, {
        method: "POST",
        body: JSON.stringify({
          rut: data.rut,
          ...(nombreVersion ? { nombreVersion } : {}),
        }),
      });

      showAlert("success", "Planificación creada exitosamente");
      await fetchProjections();
      setSelectedProjection({
        id: response.proyeccion.id,
        nombreVersion: response.proyeccion.nombreVersion,
        isIdeal: response.proyeccion.isIdeal,
      });
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloneProjection = async (id: number) => {
    const nombreVersion = window.prompt("Nombre para la nueva versión (opcional)")?.trim();
    try {
      setSaving(true);
      const response = await fetchJson<{
        proyeccion: { id: number; nombreVersion: string; isIdeal: boolean };
      }>(`/proyecciones/${id}/clone`, {
        method: "POST",
        body: JSON.stringify(nombreVersion ? { nombreVersion } : {}),
      });
      showAlert("success", "Versión clonada exitosamente");
      await fetchProjections();
      setSelectedProjection({
        id: response.proyeccion.id,
        nombreVersion: response.proyeccion.nombreVersion,
        isIdeal: response.proyeccion.isIdeal,
      });
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRenameProjection = async (id: number) => {
    const projection = projections.find((p) => p.id === id);
    if (!projection) return;
    const nuevoNombre = window.prompt("Nuevo nombre de la versión", projection.nombreVersion)?.trim();
    if (!nuevoNombre || nuevoNombre === projection.nombreVersion) return;
    try {
      setSaving(true);
      await fetchJson(`/proyecciones/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nombreVersion: nuevoNombre }),
      });
      showAlert("success", "Versión renombrada");
      await fetchProjections();
      if (selectedProjection?.id === id) {
        setSelectedProjection({ ...selectedProjection, nombreVersion: nuevoNombre });
      }
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkIdeal = async (id: number) => {
    try {
      setSaving(true);
      await fetchJson(`/proyecciones/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isIdeal: true }),
      });
      showAlert("success", "Versión marcada como ideal");
      await fetchProjections();
      if (selectedProjection?.id === id) {
        setSelectedProjection({ ...selectedProjection, isIdeal: true });
      }
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProjection = async (id: number) => {
    const projection = projections.find((p) => p.id === id);
    if (!projection) return;
    const confirmDelete = window.confirm(`¿Eliminar la versión ${projection.nombreVersion}?`);
    if (!confirmDelete) return;
    try {
      setSaving(true);
      await fetchJson(`/proyecciones/${id}`, { method: "DELETE" });
      showAlert("success", "Versión eliminada");
      await fetchProjections();
      if (selectedProjection?.id === id) {
        setSelectedProjection(null);
      }
    } catch (error) {
      console.error(error);
      showAlert("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const activeProjectionId = selectedProjection?.id ?? null;
  const activeVersion = projections.find((p) => p.id === activeProjectionId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-700">Carrera actual:</span>
        {selectedCareer ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-800">
            {selectedCareer.nombre}
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-600">
              Catálogo {selectedCareer.catalogo}
            </span>
          </span>
        ) : (
          <span className="text-slate-500">Sin carrera disponible</span>
        )}
      </div>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planificación académica</h1>
          <p className="text-sm text-slate-500">
            Arrastra ramos entre semestres y valida prerrequisitos de tu planificación.
          </p>
          {saving && <p className="mt-2 text-xs font-semibold text-blue-600">Guardando cambios...</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => fetchMalla(selectedProjection?.id)}
            disabled={loadingMalla}
          >
            Refrescar datos
          </button>
          <button
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleCreateProjection}
            disabled={saving}
          >
            Crear planificación
          </button>
          {activeProjectionId && (
            <button
              className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleAutoProjection}
              disabled={saving}
            >
              Proyeccion automatica
            </button>
          )}
          {activeProjectionId && (
            <button
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => handleCloneProjection(activeProjectionId)}
              disabled={saving}
            >
              Clonar versión actual
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={classNames(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-sm",
              alert.type === "success" && "bg-emerald-100 text-emerald-800",
              alert.type === "error" && "bg-red-100 text-red-700",
              alert.type === "info" && "bg-blue-100 text-blue-700"
            )}
          >
            {alert.text}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {selectedProjection ? `Versión ${selectedProjection.nombreVersion}` : "Sin versión seleccionada"}
              </h2>
              {activeVersion && (
                <p className="text-xs text-slate-500">
                  Créditos totales: {activeVersion.totalCreditos} · Semestres planificados: {activeVersion.cantidadSemestres}
                </p>
              )}
            </div>
            {selectedProjection?.isIdeal && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">⭐ Versión ideal</span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: maxSemester }, (_, index) => index + 1).map((semester) => (
              <SemesterColumn
                key={semester}
                semester={semester}
                courses={assignedBySemester.map.get(semester) ?? []}
                totalCredits={assignedBySemester.totals.get(semester) ?? 0}
                isActiveDrop={activeSemesterDrop === semester}
                onDropCourse={handleDropToSemester}
                onDragOver={() => setActiveSemesterDrop(semester)}
                onDragLeave={() => setActiveSemesterDrop((current) => (current === semester ? null : current))}
                onDragStart={(codigo) => setDraggingCourse(codigo)}
                onDragEnd={() => {
                  setDraggingCourse(null);
                  setActiveSemesterDrop(null);
                  setRemovalActive(false);
                }}
              />
            ))}
          </div>

          <RemovalDropZone
            active={removalActive}
            onDrop={(codigo) => {
              handleRemoveCourse(codigo);
              setRemovalActive(false);
            }}
            onHoverChange={setRemovalActive}
          />
        </section>

        <aside className="space-y-6">
          <CoursesPool
            groupedCourses={unassignedByLevel}
            activeLevel={
              draggingCourse ? planningCourses.find((course) => course.codigo === draggingCourse)?.nivel ?? null : null
            }
            onDragStart={(codigo) => {
              setDraggingCourse(codigo);
            }}
            onDragEnd={() => {
              setDraggingCourse(null);
            }}
          />

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Versiones disponibles</h3>
              <span className="text-xs text-slate-400">{projections.length} versiones</span>
            </header>
            {loadingProyecciones && <p className="text-xs text-slate-500">Cargando versiones...</p>}
            {!loadingProyecciones && projections.length === 0 && (
              <div className="space-y-3 text-sm text-slate-500">
                <p>No hay versiones guardadas todavía.</p>
                <button
                  onClick={handleCreateProjection}
                  className="w-full rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                >
                  Crear planificación
                </button>
              </div>
            )}
            <ul className="space-y-3">
              {projections.map((projection) => {
                const isSelected = projection.id === activeProjectionId;
                return (
                  <li
                    key={projection.id}
                    className={classNames(
                      "rounded-xl border p-4 transition",
                      isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white",
                      "shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <button
                          onClick={() => handleSelectProjection(projection.id)}
                          className="text-left text-sm font-semibold text-slate-800 hover:underline"
                        >
                          {projection.nombreVersion}
                        </button>
                        <p className="text-xs text-slate-500">
                          Créditos: {projection.totalCreditos} · Semestres: {projection.cantidadSemestres}
                        </p>
                        {projection.isIdeal && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            ⭐ Ideal
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs">
                        <button
                          onClick={() => handleRenameProjection(projection.id)}
                          className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Renombrar
                        </button>
                        <button
                          onClick={() => handleMarkIdeal(projection.id)}
                          className="rounded-full border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Marcar ideal
                        </button>
                        <button
                          onClick={() => handleDeleteProjection(projection.id)}
                          className="rounded-full border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {projections.length > 0 && (
              <button
                onClick={handleCreateProjection}
                className="w-full rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                Crear nueva planificación
              </button>
            )}
        
          </section>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-800">Malla curricular completa</h2>
        <p className="text-sm text-slate-500">Visualiza todos los ramos ordenados por nivel y su estado actual.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(
            courses.reduce<Record<number, AsignaturaMalla[]>>((acc, course) => {
              if (!acc[course.nivel]) acc[course.nivel] = [];
              acc[course.nivel].push(course);
              return acc;
            }, {})
          )
            .sort(([nivelA], [nivelB]) => Number(nivelA) - Number(nivelB))
            .map(([nivel, list]) => (
              <div key={nivel} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Nivel {nivel}</h3>
                  <span className="text-xs text-slate-400">{list.length} ramos</span>
                </div>
                <div className="space-y-2">
                  {list
                    .sort((a, b) => a.codigo.localeCompare(b.codigo))
                    .map((course) => (
                      <div
                        key={course.codigo}
                        className={classNames(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
                          course.asignado
                            ? estadoColorStyles[course.asignado.estado]
                            : course.historialEstado
                            ? estadoColorStyles[course.historialEstado]
                            : course.elegible
                            ? "border-slate-300 bg-white"
                            : "border-gray-300 bg-gray-100 text-gray-600"
                        )}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-inherit">
                            {course.codigo} · {course.nombre}
                          </p>
                          <p className="text-[11px] text-inherit opacity-80">{course.creditos} créditos</p>
                        </div>
                        <div
                          className={classNames(
                            "text-right text-[11px]",
                            course.asignado || course.historialEstado
                              ? "font-semibold text-inherit"
                              : course.elegible
                              ? "font-medium text-emerald-600"
                              : "font-medium text-gray-500"
                          )}
                        >
                          {course.asignado ? (
                            <span>
                              {estadoLabels[course.asignado.estado]} · S{course.asignado.semestre ?? "-"}
                            </span>
                          ) : course.historialEstado ? (
                            <span>
                              {course.historialEtiqueta ?? estadoLabels[course.historialEstado]}
                              {course.historialPeriodo ? ` · ${course.historialPeriodo}` : ""}
                            </span>
                          ) : course.elegible ? (
                            <span>Disponible</span>
                          ) : (
                            <span>Bloqueado</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </section>

      {(loadingMalla || loadingProyecciones) && <p className="text-sm text-slate-500">Actualizando información...</p>}

    </div>
  );
};

export default ProyeccionesPage;