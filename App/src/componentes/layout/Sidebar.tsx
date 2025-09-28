import { FC } from "react";

type SidebarProps = {
    active: "avance" | "historial" | "proyecciones";
    onChange: (v: SidebarProps["active"]) => void;
    nombre?: string;
    onLogout?: () => void;
};

export const Sidebar: FC<SidebarProps> = ({ active, onChange, nombre, onLogout }) => {
    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-[var(--sidebar-bg,#0e3a53)] text-white flex flex-col">
            <div className="px-6 py-5 border-b border-white/10">
                <div className="text-sm opacity-80">Estudiante</div>
                <div className="text-lg font-semibold leading-tight">{nombre || "Usuario"}</div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                <button
                    className={`w-full text-left px-4 py-2 rounded-lg ${active==="avance" ? "bg-white/15" : "hover:bg-white/10"}`}
                    onClick={() => onChange("avance")}
                >
                    Avance Curricular
                </button>
                <button
                    className={`w-full text-left px-4 py-2 rounded-lg ${active==="historial" ? "bg-white/15" : "hover:bg-white/10"}`}
                    onClick={() => onChange("historial")}
                >
                    Historial Académico
                </button>
                <button
                    className={`w-full text-left px-4 py-2 rounded-lg ${active==="proyecciones" ? "bg-white/15" : "hover:bg-white/10"}`}
                    onClick={() => onChange("proyecciones")}
                >
                    Proyecciones
                </button>
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
