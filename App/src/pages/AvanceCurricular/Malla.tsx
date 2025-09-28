import React, { useEffect, useState, useMemo } from "react";

// === Tipos tal como los tienes ===
interface Carrera {
    codigo: string;
    nombre: string;
    catalogo: string;
}

interface MallaProps {
    data: {
        rut: string;
        carreras: Carrera[];
    };
    /** Opcional: permite que App muestre solo la grilla o solo el historial */
    only?: "grid" | "historial";
}

interface Curso {
    codigo: string;
    asignatura: string;
    creditos: number;
    nivel: number;
}

interface Avance {
    nrc: string;
    period: string;
    student: string;
    course: string;
    excluded: boolean;
    inscriptionType: string;
    status: string;
}

interface AvanceMetadata {
    intentosPorCurso: Record<string, number>;
    ultimoRecordPorCurso: Record<string, Avance>;
    intentosPorNumero: Record<string, number>;
}

// === NUEVOS imports de presentación (no afectan la lógica de datos) ===
// Ajusta las rutas si tu estructura difiere
import { CareerBanner } from "../../componentes/avance/CareerBanner";
import { SemesterColumn } from "../../componentes/avance/SemesterColumn";
import { CourseCard } from "../../componentes/avance/CourseCard";

// === Helpers existentes (sin cambios de lógica) ===
const buildAvanceMetadata = (registros: Avance[]): AvanceMetadata => {
    const intentosPorCurso: Record<string, number> = {};
    const ultimoRecordPorCurso: Record<string, Avance> = {};
    const intentosPorNumero: Record<string, number> = {};

    const sortedByPeriod = [...registros].sort((a, b) =>
        a.period.localeCompare(b.period)
    );

    sortedByPeriod.forEach((registro) => {
        const intentos = (intentosPorCurso[registro.course] ?? 0) + 1;
        intentosPorCurso[registro.course] = intentos;
        ultimoRecordPorCurso[registro.course] = registro;
        intentosPorNumero[`${registro.course}-${registro.period}-${registro.nrc}`] =
            intentos;
    });

    return { intentosPorCurso, ultimoRecordPorCurso, intentosPorNumero };
};

const obtenerNombreAsignatura = (
    cursos: Curso[] | undefined,
    codigoCurso: string
) => cursos?.find((curso) => curso.codigo === codigoCurso)?.asignatura;

// === Utilidad local para I..X ===
function toRoman(n: number) {
    const romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return romans[n] || String(n);
}

const Malla: React.FC<MallaProps> = ({ data, only }) => {
    // === Estado y efectos tal como los tenías (sin cambios de lógica) ===
    const [mallas, setMallas] = useState<{ [key: string]: Curso[] }>({});
    const [avances, setAvances] = useState<{ [key: string]: Avance[] }>({});
    const [erroresAvance, setErroresAvance] = useState<{ [key: string]: string }>(
        {}
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const metadataPorCarrera = useMemo(() => {
        const resultado: { [key: string]: AvanceMetadata } = {};
        Object.entries(avances).forEach(([nombreCarrera, registros]) => {
            resultado[nombreCarrera] = buildAvanceMetadata(registros);
        });
        return resultado;
    }, [avances]);

    useEffect(() => {
        const fetchMallas = async () => {
            setLoading(true);
            setError(null);
            const nuevasMallas: { [key: string]: Curso[] } = {};
            const nuevosAvances: { [key: string]: Avance[] } = {};
            const nuevosErroresAvance: { [key: string]: string } = {};

            try {
                for (const carrera of data.carreras) {
                    const response = await fetch(
                        `/api/mallas/${carrera.codigo}/${carrera.catalogo}`
                    );

                    if (!response.ok) {
                        throw new Error(`Error cargando malla de ${carrera.nombre}`);
                    }

                    const cursos: Curso[] = await response.json();
                    nuevasMallas[carrera.nombre] = cursos;

                    try {
                        const avanceResponse = await fetch(
                            `/api/avance/${encodeURIComponent(data.rut)}/${encodeURIComponent(
                                carrera.codigo
                            )}`
                        );

                        if (!avanceResponse.ok) {
                            throw new Error("No se pudo obtener el avance académico");
                        }

                        const avanceData = await avanceResponse.json();

                        if (Array.isArray(avanceData)) {
                            nuevosAvances[carrera.nombre] = avanceData;
                        } else if (avanceData?.error) {
                            nuevosErroresAvance[carrera.nombre] = avanceData.error;
                        } else {
                            nuevosErroresAvance[carrera.nombre] =
                                "Respuesta de avance no válida";
                        }
                    } catch (avanceErr: any) {
                        console.error(avanceErr);
                        nuevosErroresAvance[carrera.nombre] =
                            avanceErr?.message || "Error desconocido al cargar el avance";
                    }
                }

                setMallas(nuevasMallas);
                setAvances(nuevosAvances);
                setErroresAvance(nuevosErroresAvance);
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Error al cargar mallas");
            } finally {
                setLoading(false);
            }
        };

        fetchMallas();
    }, [data]);

    if (loading) return <p className="text-center mt-10">Cargando mallas...</p>;
    if (error)
        return (
            <p className="text-center mt-10 text-red-500 font-semibold">{error}</p>
        );

    // === RENDER ===
    return (
        <div className="p-0">
            {/* Encabezado/Identidad por carrera */}
            {data.carreras.map((carrera) => {
                const cursos = mallas[carrera.nombre] || [];
                const meta = metadataPorCarrera[carrera.nombre];

                // Agrupación visual por nivel 1..10 (sin tocar fuentes de datos)
                const grupos = Array.from({ length: 10 }, (_, i) => i + 1).map(
                    (nivel) => ({
                        nivel,
                        items: cursos.filter((c) => Number(c.nivel) === nivel),
                    })
                );

                return (
                    <div key={carrera.codigo} className="mb-10">
                        {/* Banner de carrera (rectángulo azul) */}
                        <div className="mb-4">
                            <CareerBanner carrera={carrera.nombre} />
                        </div>

                        {/* === GRID DE MALLA POR SEMESTRES === */}
                        {(only === undefined || only === "grid") && (
                            <section className="mb-6">
                                <div className="flex gap-2 overflow-x-auto pb-2 text-[13px]">
                                    {grupos.map((g) => (
                                        <SemesterColumn key={g.nivel} roman={toRoman(g.nivel)}>
                                            {g.items.length === 0 ? (
                                                <div className="text-xs text-slate-500 italic px-2">
                                                    Sin ramos asignados
                                                </div>
                                            ) : (
                                                g.items.map((curso) => {
                                                    const codigo = curso.codigo;
                                                    const intentos = meta?.intentosPorCurso[codigo] ?? 0;
                                                    const ultimoRegistro = meta?.ultimoRecordPorCurso[codigo];
                                                    const ultimoEstado = ultimoRegistro?.status as
                                                        | "APROBADO"
                                                        | "REPROBADO"
                                                        | "INSCRITO"
                                                        | undefined;

                                                    return (
                                                        <CourseCard
                                                            key={codigo}
                                                            nombre={curso.asignatura}
                                                            codigo={codigo}
                                                            creditos={curso.creditos}
                                                            estado={ultimoEstado || "PENDIENTE"}
                                                            // Tu payload de Avance no trae NF, lo dejamos fuera sin cambiar lógica:
                                                            nf={undefined}
                                                            intentos={intentos > 0 ? intentos : undefined}
                                                        />
                                                    );
                                                })
                                            )}
                                        </SemesterColumn>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* === HISTORIAL ACADÉMICO (tal cual lo tenías) === */}
                        {(only === undefined || only === "historial") && (
                            <section className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <h3 className="text-lg font-semibold">Historial académico</h3>
                                    {Array.isArray(avances[carrera.nombre]) && (
                                        <div className="flex gap-4 text-sm">
                      <span className="text-green-600 font-medium">
                        Aprobados:{" "}
                          {avances[carrera.nombre]?.filter(
                              (registro) => registro.status === "APROBADO"
                          ).length || 0}
                      </span>
                                            <span className="text-red-600 font-medium">
                        Reprobados:{" "}
                                                {avances[carrera.nombre]?.filter(
                                                    (registro) => registro.status === "REPROBADO"
                                                ).length || 0}
                      </span>
                                        </div>
                                    )}
                                </div>

                                {erroresAvance[carrera.nombre] ? (
                                    <p className="text-sm text-red-500">
                                        {erroresAvance[carrera.nombre]}
                                    </p>
                                ) : avances[carrera.nombre]?.length ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                                            <thead className="bg-slate-100">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                                    Asignatura
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                                    Periodo
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                                    Intento
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                                    Tipo inscripción
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                                    Estado
                                                </th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                            {[...(avances[carrera.nombre] ?? [])]
                                                .sort((a, b) => b.period.localeCompare(a.period))
                                                .map((registro) => {
                                                    const intento = meta?.intentosPorNumero[
                                                        `${registro.course}-${registro.period}-${registro.nrc}`
                                                        ];
                                                    const nombreAsignatura = obtenerNombreAsignatura(
                                                        mallas[carrera.nombre],
                                                        registro.course
                                                    );

                                                    return (
                                                        <tr key={`${registro.nrc}-${registro.period}`}>
                                                            <td className="px-3 py-2 text-slate-800">
                                                                <p className="font-medium">
                                                                    {nombreAsignatura ?? "Asignatura no disponible"}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {registro.course}
                                                                </p>
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-600">
                                                                {registro.period}
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-600">
                                                                {intento ? `Intento ${intento}` : "-"}
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-600">
                                                                {registro.inscriptionType}
                                                            </td>
                                                            <td className="px-3 py-2">
                                  <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                          registro.status === "APROBADO"
                                              ? "bg-green-100 text-green-700"
                                              : registro.status === "REPROBADO"
                                                  ? "bg-red-100 text-red-700"
                                                  : registro.status === "INSCRITO"
                                                      ? "bg-yellow-100 text-yellow-700"
                                                      : "bg-slate-100 text-slate-700"
                                      }`}
                                  >
                                    {registro.status}
                                  </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-600">
                                        No hay historial académico disponible.
                                    </p>
                                )}
                            </section>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default Malla;
