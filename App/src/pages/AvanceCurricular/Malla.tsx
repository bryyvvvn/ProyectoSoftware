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
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [meta, setMeta] = useState<AvanceMetadata>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMalla = async () => {
      setLoading(true);
      try {
        const carrera = data.carreras[0];
        const resCursos = await fetch(`/api/malla/${carrera.codigo}/${carrera.catalogo}`);
        if (!resCursos.ok) throw new Error("Error cargando la malla");
        const cursosJson: Curso[] = await resCursos.json();
        setCursos(cursosJson);

        const resAvance = await fetch(`/api/historial/${encodeURIComponent(data.rut)}/${encodeURIComponent(carrera.codigo)}`);
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
  }, [data]);

  if (loading) return <p className="text-center mt-10">Cargando malla curricular...</p>;
  if (error) return <p className="text-center mt-10 text-red-500 font-semibold">{error}</p>;

  return (
  <div>
    <CareerBanner carrera={data.carreras[0].nombre} />

    {/* Espacio visual entre el banner y la malla */}
    <div className="mt-8"></div>

    <section className="mb-6">
      <div className="flex gap-2 overflow-x-auto pb-2 text-[13px]">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((nivel) => {
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
