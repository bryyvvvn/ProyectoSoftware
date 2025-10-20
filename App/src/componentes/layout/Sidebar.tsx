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
            <div className="px-6 py-5 border-b border-white/10">
                <div className="text-sm opacity-80">Estudiante</div>
                <div className="text-lg font-semibold leading-tight">{nombre || "Usuario"}</div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                {links.map(link => {
                    const isActive = location.pathname === link.path;
                    return (
                        <button
                            key={link.key}
                            className={`w-full text-left px-4 py-2 rounded-lg ${isActive ? "bg-white/15" : "hover:bg-white/10"}`}
                            onClick={() => navigate(link.path)}
                        >
                            {link.label}
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/10">
                <button
                    className="w-full bg-[var(--brand,#f59e0b)] hover:opacity-90 text-black font-medium rounded-lg px-4 py-2"
                    onClick={onLogout}
                >
                    Cerrar sesión
                </button>
            </div>
        </aside>
    );
};
