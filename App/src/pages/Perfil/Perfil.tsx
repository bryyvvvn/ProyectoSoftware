import React, { useEffect, useState, useMemo } from "react";

// --- Interfaces ---
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

interface UserData {
  rut: string;
  carreras: Carrera[];
}

interface CursoMallaBase {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
}

interface HistorialRegistro {
  course: string;
  status: string;
  period?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000";

const PerfilPage: React.FC<{ data: UserData }> = ({ data }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCreditos: 0,
    creditosAprobados: 0,
    totalRamos: 0,
    ramosAprobados: 0,
    ramosReprobados: 0,
    progreso: 0,
    nivelAcademico: 1, // Semestre más bajo pendiente
    esEgresado: false,
  });

  const carreraActual = useMemo(() => data.carreras[0], [data.carreras]);

  useEffect(() => {
    const fetchData = async () => {
      if (!carreraActual || !data.rut) return;
      setLoading(true);

      try {
        const [mallaRes, historialRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/malla/${encodeURIComponent(carreraActual.codigo)}/${encodeURIComponent(carreraActual.catalogo)}`),
          fetch(`${API_BASE_URL}/api/historial/${encodeURIComponent(data.rut)}/${encodeURIComponent(carreraActual.codigo)}`)
        ]);

        if (!mallaRes.ok) throw new Error("Error cargando malla");
        
        const malla: CursoMallaBase[] = await mallaRes.json();
        const historial: HistorialRegistro[] = await historialRes.json().catch(() => []);

        // 1. Totales Malla
        const totalCreditos = malla.reduce((acc, curr) => acc + curr.creditos, 0);
        const totalRamos = malla.length;

        // 2. Procesar Historial
        const aprobadosSet = new Set<string>();
        let contadorReprobados = 0;

        historial.forEach((h) => {
          const status = h.status?.toUpperCase() || "";
          
          if (["APROBADO", "APROBADA", "CONVALIDADO", "RECONOCIDO"].some(s => status.includes(s))) {
            aprobadosSet.add(h.course.trim().toUpperCase());
          } else if (["REPROBADO", "REPROBADA"].some(s => status.includes(s))) {
            contadorReprobados++;
          }
        });

        // 3. Calcular Aprobados Reales (cruce con malla)
        let creditosAprobados = 0;
        let ramosAprobados = 0;

        malla.forEach((curso) => {
          if (aprobadosSet.has(curso.codigo.toUpperCase())) {
            creditosAprobados += curso.creditos;
            ramosAprobados += 1;
          }
        });

        // 4. Calcular Nivel Académico (Ramo pendiente más antiguo)
        const ramosPendientes = malla.filter((c) => !aprobadosSet.has(c.codigo.toUpperCase()));
        let nivelReal = 1;
        let esEgresado = false;

        if (ramosPendientes.length > 0) {
          nivelReal = Math.min(...ramosPendientes.map((c) => c.nivel));
        } else if (totalRamos > 0) {
          // Si aprobó todo
          nivelReal = Math.max(...malla.map((c) => c.nivel));
          esEgresado = true;
        }

        const porcentaje = totalCreditos > 0 ? (creditosAprobados / totalCreditos) * 100 : 0;

        setStats({
          totalCreditos,
          creditosAprobados,
          totalRamos,
          ramosAprobados,
          ramosReprobados: contadorReprobados,
          progreso: Math.round(porcentaje),
          nivelAcademico: nivelReal,
          esEgresado,
        });

      } catch (error) {
        console.error("Error calculando perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [data.rut, carreraActual]);

  if (!carreraActual) return <div className="p-8 text-slate-500">No hay información de carrera.</div>;

  // Cálculo del AÑO basado en el semestre (Nivel / 2 redondeado hacia arriba)
  const anioAcademico = Math.ceil(stats.nivelAcademico / 2);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      
      {/* 1. HEADER (Tarjeta de Perfil) */}
      <div className="flex flex-col md:flex-row items-center gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center text-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-20 w-20">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-slate-800">Estudiante</h1>
          <p className="font-mono text-lg text-slate-500">{data.rut}</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            <span>🎓 {carreraActual.nombre}</span>
            <span className="text-blue-300">|</span>
            <span>Catálogo {carreraActual.catalogo}</span>
          </div>
        </div>
      </div>

      {/* 2. GRID DE 4 ESTADÍSTICAS (Ahora va primero) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* A. CRÉDITOS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-emerald-100 p-2 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Créditos</p>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                {loading ? "-" : stats.creditosAprobados} 
                <span className="text-sm font-normal text-slate-400"> / {stats.totalCreditos}</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                 Total créditos aprobados
              </p>
            </div>
          </div>
        </div>

        {/* B. RAMOS APROBADOS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-blue-100 p-2 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Aprobados</p>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                 {loading ? "-" : stats.ramosAprobados}
                 <span className="text-sm font-normal text-slate-400"> / {stats.totalRamos}</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                 Asignaturas listas
              </p>
            </div>
          </div>
        </div>

        {/* C. RAMOS REPROBADOS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-red-100 p-2 text-red-600">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reprobados</p>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                 {loading ? "-" : stats.ramosReprobados}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                 Total histórico de caídas
              </p>
            </div>
          </div>
        </div>

        {/* D. AÑO ACADÉMICO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-purple-100 p-2 text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Año Académico</p>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                 {loading ? "-" : stats.esEgresado ? "Egresado" : `${anioAcademico}° Año`}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                 {loading ? "Calculando..." : stats.esEgresado ? "¡Carrera completa!" : `Debes ramos del semestre ${stats.nivelAcademico}`}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* 3. BARRA DE PROGRESO (Ahora va al final) */}
      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-lg font-semibold text-slate-700">Progreso de Carrera</h2>
          <span className="text-2xl font-bold text-[#0e3a53]">{loading ? "..." : `${stats.progreso}%`}</span>
        </div>
        
        <div className="relative h-6 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner">
          {/* Barra Sólida Azul Oscuro */}
          <div 
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
            style={{ 
              width: `${stats.progreso}%`,
              backgroundColor: "#0e3a53" 
            }}
          />
        </div>
        <p className="text-right text-xs text-slate-400">Basado en créditos aprobados vs totales</p>
      </section>

    </div>
  );
};

export default PerfilPage;