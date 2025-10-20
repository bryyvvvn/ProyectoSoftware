import React, { useEffect, useState } from "react";

// Tipos
export interface Carrera { codigo: string; nombre: string; catalogo: string; }
export interface Curso { codigo: string; asignatura: string; creditos: number; nivel: number; }
export interface Avance { nrc: string; period: string; student: string; course: string; excluded: boolean; inscriptionType: string; status: string; }
export interface AvanceMetadata { intentosPorCurso: Record<string, number>; ultimoRecordPorCurso: Record<string, Avance>; intentosPorNumero: Record<string, number>; }

interface HistorialPageProps {
  data: { rut: string; carreras: Carrera[] };
}

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

// Nombre de asignatura
const obtenerNombreAsignatura = (cursos: Curso[], codigoCurso: string) => cursos.find(c => c.codigo===codigoCurso)?.asignatura;

const Historial: React.FC<HistorialPageProps> = ({ data }) => {
  const [avances, setAvances] = useState<Avance[]>([]);
  const [meta, setMeta] = useState<AvanceMetadata>();
  const [cursosMalla, setCursosMalla] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorAvance, setErrorAvance] = useState<string>();

  useEffect(() => {
    const fetchHistorial = async () => {
      setLoading(true);
      try {
        const carrera = data.carreras[0];

        const resCursos = await fetch(`/api/malla/${carrera.codigo}/${carrera.catalogo}`);
        const cursosJson: Curso[] = await resCursos.json();
        setCursosMalla(cursosJson);

        const resAvance = await fetch(`/api/historial/${encodeURIComponent(data.rut)}/${encodeURIComponent(carrera.codigo)}`);
        const avanceJson = await resAvance.json();

        if (Array.isArray(avanceJson)) {
          setAvances(avanceJson);
          setMeta(buildAvanceMetadata(avanceJson));
        } else if (avanceJson?.error) setErrorAvance(avanceJson.error);
        else setErrorAvance("Respuesta de avance no válida");
      } catch (err: any) {
        setErrorAvance(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [data]);

  if (loading) return <p className="text-center mt-10">Cargando historial académico...</p>;
  if (errorAvance) return <p className="text-center mt-10 text-red-500">{errorAvance}</p>;

  const aprobados = avances.filter(r => r.status==="APROBADO").length;
  const reprobados = avances.filter(r => r.status==="REPROBADO").length;

  return (
    <section className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold">Historial académico</h3>
        <div className="flex gap-4 text-sm">
          <span className="text-green-600 font-medium">Aprobados: {aprobados}</span>
          <span className="text-red-600 font-medium">Reprobados: {reprobados}</span>
        </div>
      </div>

      {avances.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Asignatura</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Periodo</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Intento</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Tipo inscripción</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[...avances].sort((a,b)=>b.period.localeCompare(a.period)).map(r => {
                const intento = meta?.intentosPorNumero[`${r.course}-${r.period}-${r.nrc}`];
                const nombreAsignatura = obtenerNombreAsignatura(cursosMalla, r.course);
                return (
                  <tr key={`${r.nrc}-${r.period}`}>
                    <td className="px-3 py-2 text-slate-800">
                      <p className="font-medium">{nombreAsignatura ?? "Asignatura no disponible"}</p>
                      <p className="text-xs text-slate-500">{r.course}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.period}</td>
                    <td className="px-3 py-2 text-slate-600">{intento ? `Intento ${intento}` : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.inscriptionType}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        r.status==="APROBADO" ? "bg-green-100 text-green-700" :
                        r.status==="REPROBADO" ? "bg-red-100 text-red-700" :
                        r.status==="INSCRITO" ? "bg-yellow-100 text-yellow-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-600">No hay historial académico disponible.</p>}
    </section>
  );
};

export default Historial;
