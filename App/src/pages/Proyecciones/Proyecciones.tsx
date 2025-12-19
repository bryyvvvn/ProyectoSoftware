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
}> = ({ course, draggable = true, onDragStart, onDragEnd }) => {
  const estadoActual = course.asignado?.estado ?? "proyectado";
  const historialEstado = course.historialEstado ?? null;
  const historialEtiqueta = course.historialEtiqueta ?? null;
  const historialPeriodo = course.historialPeriodo ?? null;
  const blocked = !course.elegible && !course.asignado && !historialEstado;
  const isAssigned = Boolean(course.asignado);
  const isApproved = historialEstado === "cursado" && !isAssigned;
  
  const assignedStyles = "border-blue-400 bg-blue-50 text-blue-900";
  
  const baseStyles = blocked
    ? "border-slate-200 bg-slate-50 text-slate-400" 
    : isAssigned
    ? assignedStyles
    : historialEstado
    ? estadoColorStyles[historialEstado]
    : "border-slate-300 bg-white text-slate-900";
    
  const canDrag = draggable && (!blocked || isAssigned) && !isApproved;

  const expandedMotivos = React.useMemo(() => {
    return course.motivos.flatMap((m) => {
      if (m.startsWith("Faltan prerrequisitos:") || m.startsWith("Error de orden:")) {
        const content = m.split(":")[1] || "";
        return content.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [m];
    });
  }, [course.motivos]);

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
        "rounded-md border shadow-sm transition-shadow",
        "p-3 space-y-1", // <--- CAMBIADO A P-3
        baseStyles,
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed",
        "relative hover:z-50" 
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="font-bold text-[11px] tracking-tight truncate">{course.codigo}</p>
          <p className="text-[14px] font-medium leading-tight line-clamp-2">{course.nombre}</p>
        </div>
        <span className={classNames(
            "shrink-0 text-[10px] font-bold uppercase tracking-wide px-1 rounded",
            blocked ? "bg-slate-200 text-slate-500" : "bg-white/40"
        )}>
            {course.creditos} Cr
        </span>
      </div>
      
      

      {(historialEtiqueta || historialPeriodo) && (
        <p className="text-[12px] font-medium opacity-90 truncate">
          {historialEtiqueta ?? "—"} {historialPeriodo ? `· ${historialPeriodo}` : ""}
        </p>
      )}

      {course.asignado && (
        <div className="flex items-center justify-between gap-2 text-[14px]">
          <span className="font-bold opacity-80">Sem  {course.asignado.semestre ?? "-"}</span>
        </div>
      )}

      {expandedMotivos.length > 0 && (
        <div className="group relative mt-0.5">
          <div className="inline-flex w-fit cursor-help items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 border border-red-100 hover:bg-red-100">
             <span className="text-[9px] font-bold uppercase tracking-wider text-red-800">
               ⚠️ {expandedMotivos.length}
             </span>
          </div>
          
          <div className="absolute bottom-full left-0 z-50 hidden w-[200px] pb-2 group-hover:block">
             <div className="rounded border border-red-200 bg-white p-2 shadow-xl ring-1 ring-black/5">
                <ul className="max-h-32 overflow-y-auto space-y-1 px-1 custom-scrollbar">
                  {expandedMotivos.map((motivo, idx) => (
                    <li key={idx} className="flex items-start gap-1 text-[10px] leading-snug text-red-700 break-words text-left">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span className="text-slate-700 font-medium">{motivo}</span>
                    </li>
                  ))}
                </ul>
             </div>
          </div>
        </div>
      )}
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
      "flex h-full flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2 shadow-sm transition", 
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
    <header className="flex items-center justify-between px-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Sem {semester}</h3>
      <span className={classNames("text-[10px] font-bold", totalCredits > 32 ? "text-red-600" : "text-slate-500")}> 
        {totalCredits}/32
      </span>
    </header>
    <div className="flex flex-1 flex-col gap-2">
      {courses.length === 0 ? (
        <div className="flex h-12 items-center justify-center rounded border border-dashed border-slate-300 bg-white/50">
            <span className="text-[10px] text-slate-400">Vacío</span>
        </div>
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
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between px-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Banco de cursos</h3>
      {typeof activeLevel === "number" && (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          Nivel {activeLevel}
        </span>
      )}
    </div>

    <div className="max-h-[600px] overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-2 shadow-sm scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
      <div className="grid gap-4">
        {Object.keys(groupedCourses).length === 0 && (
          <div className="flex h-32 items-center justify-center text-center">
             <p className="text-xs text-slate-400">¡Todo planificado! </p>
          </div>
        )}
        {Object.entries(groupedCourses)
          .sort(([nivelA], [nivelB]) => Number(nivelA) - Number(nivelB))
          .map(([nivel, cursos]) => (
            <div key={nivel} className="space-y-2">
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 py-1.5 backdrop-blur-sm">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Semestre {nivel}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                    {cursos.length}
                  </span>
                </div>
              </div>
              
              <div className="grid gap-2 grid-cols-1">
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

  const activeProjectionId = selectedProjection?.id ?? null;
  const activeVersion = projections.find((p) => p.id === activeProjectionId) ?? null;

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

      if (currentId && availableIds.includes(currentId)) {
        setLoadingProyecciones(false);
        return; 
      }
      
      if (!currentId) {
        if (response.proyecciones.length > 0) {
           const lista = response.proyecciones;
           const primera = lista.find((p) => p.isIdeal) ?? lista[lista.length - 1];
           
           setSelectedProjection({ id: primera.id, nombreVersion: primera.nombreVersion, isIdeal: primera.isIdeal });
        }
      } else if (!availableIds.includes(currentId)) {
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
        const urlBase = `/api/malla/${encodeURIComponent(carrera.codigo)}/${encodeURIComponent(carrera.catalogo)}`;
        const urlHistorial = `/api/historial/${encodeURIComponent(data.rut)}/${encodeURIComponent(carrera.codigo)}`;

        const [baseRes, historialRes] = await Promise.all([
            fetch(urlBase),
            fetchJson<HistorialRegistro[]>(urlHistorial).catch(err => {
                console.error("Error historial (se continuará sin él):", err);
                return [] as HistorialRegistro[];
            })
        ]);

        if (!baseRes.ok) throw new Error("No fue posible obtener la malla base");
        
        const baseCourses = (await baseRes.json()) as CursoMallaBase[];
        const baseMap = new Map(baseCourses.map((course) => [course.codigo, course] as const));

        const historialRecords = Array.isArray(historialRes) ? historialRes : [];
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
          
          const url = `/malla/${encodeURIComponent(data.rut)}${params.toString() ? `?${params.toString()}` : ""}`;
          projectionResponse = await fetchJson<MallaResponse>(url);

          if (projectionId && projectionResponse.proyeccionSeleccionada) {
             setSelectedProjection(projectionResponse.proyeccionSeleccionada);
          }
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
            motivos: Array.isArray(course.motivos) ? course.motivos : [],
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
                ? { ...projectionInfo.asignado, estado: normalizeEstadoAsignatura(projectionInfo.asignado.estado) ?? "proyectado" }
                : null,
              nombre: course.asignatura,
              creditos: course.creditos,
              nivel: Number(course.nivel),
              prereq: Array.isArray(projectionInfo.prereq) ? projectionInfo.prereq : [],
              motivos: projectionInfo.motivos || [],
              historialEstado: historialInfo?.estado ?? normalizeEstadoAsignatura(projectionInfo.historialEstado) ?? null,
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
          combined.push({
            ...course,
            asignado: course.asignado
              ? { ...course.asignado, estado: normalizeEstadoAsignatura(course.asignado.estado) ?? "proyectado" }
              : null,
            prereq: Array.isArray(course.prereq) ? course.prereq : [],
            motivos: course.motivos || [],
            nombre: course.nombre ?? base?.asignatura ?? course.codigo,
            creditos: course.creditos ?? base?.creditos ?? 0,
            nivel: Number(course.nivel ?? base?.nivel ?? 0),
            historialEstado: historialInfo?.estado ?? normalizeEstadoAsignatura(course.historialEstado) ?? null,
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

  const unassignedByLevel = useMemo(() => {
    const getNum = (str: string) => str.replace(/[^0-9]/g, "");
    const unavailableNumerics = new Set<string>();

    planningCourses.forEach((c) => {
      if (c.asignado?.semestre || c.historialEstado === "cursado") {
        unavailableNumerics.add(getNum(c.codigo));
      }
    });

    const grouped: Record<number, AsignaturaMalla[]> = {};
    
    planningCourses
      .filter((course) => {
        const myNum = getNum(course.codigo);
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
    const minSemesters = activeVersion?.cantidadSemestres || 10;
    
    return Math.max(minSemesters, maxDetected);
  }, [assignedBySemester.map, planningCourses, activeVersion]);

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

  const handleAutoProjection = async () => {
    if (!selectedProjection?.id) return;
    const confirm = window.confirm("Esto reordenará todos los ramos futuros automáticamente. ¿Continuar?");
    if (!confirm) return;

    try {
      setSaving(true);
      await fetchJson(`/proyecciones/${selectedProjection.id}/auto`, {
        method: "POST",
        body: JSON.stringify({ 
          rut: data.rut, 
          aprobadas: approvedCourseCodes,
          catalogo: selectedCareer?.catalogo
        }),
      });
      
      showAlert("success", "✨ Proyección automática generada");
      setCourses([]); 

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


  return (
    <div className="space-y-6">
      {/* 1. INFO DE LA CARRERA */}
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

      {/* 2. ENCABEZADO PRINCIPAL */}
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
            className="rounded-full bg-[#0e3a53] px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleCreateProjection}
            disabled={saving}
          >
            Crear planificación
          </button>
          {activeProjectionId && (
            <button
              className="rounded-full bg-[#0e3a53] px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleAutoProjection}
              disabled={saving}
            >
              Proyección automática
            </button>
          )}
          {activeProjectionId && (
            <button
              className="rounded-full bg-[#0e3a53] px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => handleCloneProjection(activeProjectionId)}
              disabled={saving}
            >
              Clonar versión actual
            </button>
          )}
        </div>
      </header>

      {/* 3. ALERTAS */}
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

      {/* 4. ÁREA PRINCIPAL (Semestres + Barra Lateral) */}
      <div className="grid gap-6 xl:grid-cols-[3fr_1fr] items-start">
        
        {/* COLUMNA IZQUIERDA: SEMESTRES */}
        <section className="space-y-4 min-w-0"> 
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {selectedProjection ? `Versión ${selectedProjection.nombreVersion}` : "Sin versión seleccionada"}
              </h2>
              {activeVersion && (
                <p className="text-xs text-slate-500">
                  Créditos: {activeVersion.totalCreditos} · Semestres: {activeVersion.cantidadSemestres}
                </p>
              )}
            </div>
            {selectedProjection?.isIdeal && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">⭐ Ideal</span>
            )}
          </div>

          {/* Semestres con Scroll Horizontal y Diseño Compacto */}
          <div className="flex w-full overflow-x-auto gap-2 pb-4 items-start scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            {Array.from({ length: maxSemester }, (_, index) => index + 1).map((semester) => (
              
              <div key={semester} className="min-w-[250px] flex-shrink-0">
                <SemesterColumn
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
              </div>
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

        {/* COLUMNA DERECHA: BANCO Y VERSIONES */}
        <aside className="space-y-6 min-w-0">
          
          {/* A. Banco de Cursos */}
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

          {/* B. Lista de Versiones (BOTONES SIEMPRE VISIBLES) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Versiones disponibles</h3>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {projections.length}
              </span>
            </div>

            <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-2 shadow-sm scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              
              {loadingProyecciones && <p className="p-2 text-center text-xs text-slate-400">Cargando...</p>}

              {!loadingProyecciones && projections.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
                  <p className="text-xs text-slate-400">Sin versiones.</p>
                  <button
                    onClick={handleCreateProjection}
                    className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    disabled={saving}
                  >
                    Crear nueva
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {projections.map((projection) => {
                  const isSelected = projection.id === activeProjectionId;
                  return (
                    <li
                      key={projection.id}
                      className={classNames(
                        "group relative rounded-md border p-2 transition-all cursor-pointer",
                        isSelected 
                          ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-400" 
                          : "border-slate-200 bg-white hover:border-slate-300",
                        "shadow-sm"
                      )}
                      onClick={() => handleSelectProjection(projection.id)}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700 truncate w-full" title={projection.nombreVersion}>
                            {projection.nombreVersion}
                          </span>
                          {projection.isIdeal && (
                            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                              Ideal
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-slate-400">
                            {projection.totalCreditos} Cr · {projection.cantidadSemestres} Sem
                          </span>
                        </div>

                        {/* Botonera de Texto (SIEMPRE VISIBLE) */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 mt-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRenameProjection(projection.id); }}
                                className="rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                            >
                                Renombrar
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleMarkIdeal(projection.id); }}
                                className={classNames(
                                    "rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors",
                                    projection.isIdeal 
                                      ? "text-amber-600 bg-amber-50" 
                                      : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                                )}
                            >
                                ★ Ideal
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteProjection(projection.id); }}
                                className="rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
                  className="mt-3 w-full rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  disabled={saving}
                >
                  + Nueva versión
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 5. MALLA CURRICULAR COMPLETA */}
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
                  <h3 className="text-sm font-semibold text-slate-700">Semestre {nivel}</h3>
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