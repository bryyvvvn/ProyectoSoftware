import { FC } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type SidebarProps = {
  nombre?: string;
  onLogout?: () => void;
};

export const Sidebar: FC<SidebarProps> = ({ nombre, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { label: "Avance Curricular", path: "/malla", key: "avance" },
    { label: "Historial Académico", path: "/historial", key: "historial" },
    { label: "Proyecciones", path: "/proyecciones", key: "proyecciones" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[var(--sidebar-bg,#0e3a53)] text-white flex flex-col z-50">
      
      {/* --- SECCIÓN DE PERFIL --- */}
      <div className="p-4 border-b border-white/10">
        <button
          onClick={() => navigate("/perfil")}
          className="group flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left transition-all hover:bg-white/10 hover:shadow-md active:scale-95"
          title="Ver perfil"
        >
          {/* CAMBIO AQUÍ: Sin fondo (quitado bg-slate-300), ícono blanco (text-white) */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center text-white">
            {/* SVG de contorno que enviaste */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </div>

          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">
              Estudiante
            </span>
            <span className="truncate text-xs text-white/60">
              {nombre || "Usuario"}
            </span>
          </div>

          <div className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
             </svg>
          </div>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.key}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                isActive ? "bg-white/15 font-medium" : "hover:bg-white/10 text-white/80 hover:text-white"
              }`}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          className="w-full bg-[var(--brand,#f59e0b)] hover:opacity-90 text-white font-medium rounded-lg px-4 py-2 transition-opacity mb-3"
          onClick={onLogout}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};