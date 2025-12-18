import React, { useEffect, useState, useMemo } from "react";
import { CareerBanner } from "../../componentes/avance/CareerBanner";
import { SemesterColumn } from "../../componentes/avance/SemesterColumn";
import { CourseCard } from "../../componentes/avance/CourseCard";

// Tipos
export interface Carrera { codigo: string; nombre: string; catalogo: string; }
export interface Curso { codigo: string; asignatura: string; creditos: number; nivel: number; }
export interface Avance { nrc: string; period: string; student: string; course: string; excluded: boolean; inscriptionType: string; status: string; }
export interface AvanceMetadata { intentosPorCurso: Record<string, number>; ultimoRecordPorCurso: Record<string, Avance>; intentosPorNumero: Record<string, number>; }

interface MallaPageProps { data: { rut: string; carreras: Carrera[] }; }

// Helper para números romanos
const toRoman = (n: number) => ["", "I","II","III","IV","V","VI","VII","VIII","IX","X"][n] || String(n);

// Construye metadata
const buildAvanceMetadata = (registros: Avance[]): AvanceMetadata => {
  const intentosPorCurso: Record<string, number> = {};
  const ultimoRecordPorCurso: Record<string, Avance> = {};
  const intentosPorNumero: Record<string, number> = {};

  [...registros].sort((a,b) => a.period.localeCompare(b.period))
    .forEach(registro => {
      const intentos = (intentosPorCurso[registro.course] ?? 0) + 1;
      intentosPorCurso[registro.course] = intentos;
      ultimoRecordPorCurso[registro.course] = registro;
      intentosPorNumero[`${registro.course}-${registro.period}-${registro.nrc}`] = intentos;
    });

  return { intentosPorCurso, ultimoRecordPorCurso, intentosPorNumero };
};

const Malla: React.FC<MallaPageProps> = ({ data }) => {
  const [selectedCarrera, setSelectedCarrera] = useState<Carrera | null>(data.carreras?.[0] ?? null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [meta, setMeta] = useState<AvanceMetadata>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCarrera((prev) => {
      if (!data.carreras?.length) return null;
      const stillExists = prev && data.carreras.find((carrera) => carrera.codigo === prev.codigo && carrera.catalogo === prev.catalogo);
      return stillExists ?? data.carreras[0];
    });
  }, [data.carreras]);

  useEffect(() => {
    const fetchMalla = async () => {
      setLoading(true);
      try {
        if (!selectedCarrera) throw new Error("Sin carreras asociadas");
        const resCursos = await fetch(`/api/malla/${selectedCarrera.codigo}/${selectedCarrera.catalogo}`);
        if (!resCursos.ok) throw new Error("Error cargando la malla");
        const cursosJson: Curso[] = await resCursos.json();
        setCursos(cursosJson);

        const resAvance = await fetch(`/api/historial/${encodeURIComponent(data.rut)}/${encodeURIComponent(selectedCarrera.codigo)}`);
        const avanceJson: Avance[] = await resAvance.json();
        setAvances(avanceJson);
        setMeta(buildAvanceMetadata(avanceJson));
      } catch (err: any) {
        setError(err?.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchMalla();
  }, [data.rut, selectedCarrera]);

  const maxNivel = useMemo(() => {
    const niveles = cursos.map((curso) => Number(curso.nivel) || 0);
    return niveles.length ? Math.max(...niveles) : 0;
  }, [cursos]);

  if (loading) return <p className="text-center mt-10">Cargando malla curricular...</p>;
  if (error) return <p className="text-center mt-10 text-red-500 font-semibold">{error}</p>;

  return (
  <div>
    <CareerBanner carrera={selectedCarrera?.nombre ?? "Carrera sin nombre"} />

    {/* Espacio visual entre el banner y la malla */}
    <div className="mt-8"></div>

    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-slate-700">Carrera:</span>
      {data.carreras.map((carrera) => {
        const isActive = carrera.codigo === selectedCarrera?.codigo && carrera.catalogo === selectedCarrera.catalogo;
        return (
          <button
            key={`${carrera.codigo}-${carrera.catalogo}`}
            onClick={() => setSelectedCarrera(carrera)}
            className={`rounded-full border px-3 py-1 font-semibold transition ${
              isActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {carrera.nombre}
          </button>
        );
      })}
    </div>

    <section className="mb-6">
      <div className="flex gap-2 overflow-x-auto pb-2 text-[13px]">
        {Array.from({ length: Math.max(1, maxNivel || 1) }, (_, i) => i + 1).map((nivel) => {
          const items = cursos.filter(c => Number(c.nivel) === nivel);
          return (
            <SemesterColumn key={nivel} roman={toRoman(nivel)}>
              {items.length === 0 ? (
                <div className="text-xs text-slate-500 italic px-2">Sin ramos asignados</div>
              ) : items.map(curso => {
                const codigo = curso.codigo;
                const intentos = meta?.intentosPorCurso[codigo] ?? 0;
                const ultimoRegistro = meta?.ultimoRecordPorCurso[codigo];
                const ultimoEstado = ultimoRegistro?.status as "APROBADO" | "REPROBADO" | "INSCRITO" | undefined;

                return (
                  <CourseCard
                    key={codigo}
                    nombre={curso.asignatura}
                    codigo={codigo}
                    creditos={curso.creditos}
                    estado={ultimoEstado || "PENDIENTE"}
                    nf={undefined}
                    intentos={intentos > 0 ? intentos : undefined}
                  />
                );
              })}
            </SemesterColumn>
          );
        })}
      </div>
    </section>
  </div>
  );
};

export default Malla;
