import { FC } from "react";

type Props = {
    nombre: string;
    codigo: string;
    creditos: number;
    estado?: "APROBADO" | "REPROBADO" | "INSCRITO" | "PENDIENTE";
    nf?: number | null;
    intentos?: number;
};

const estadoStyles: Record<NonNullable<Props["estado"]>, string> = {
    APROBADO: "bg-green-200",
    REPROBADO: "bg-red-200",
    INSCRITO: "bg-yellow-200",
    PENDIENTE: "bg-white",
};

export const CourseCard: FC<Props> = ({ nombre, codigo, creditos, estado="PENDIENTE", nf, intentos }) => (
    <div className={`rounded-lg shadow-sm px-3 py-2 ${estadoStyles[estado]} flex flex-col justify-between`}>
        <div className="flex items-start justify-between">
            {/* Intentos */}
            {typeof intentos === "number" && intentos > 1 ? (
                <span className="text-[10px] font-semibold bg-black/10 text-black rounded-full px-1.5 py-0.5 leading-none">
                    {intentos}
                </span>
            ) : <span />}

            {/* Código */}
            <span className="text-[11px] text-slate-600 leading-none">{codigo}</span>
        </div>

        <div className="mt-1 mb-1.5 font-semibold leading-snug text-[13px] line-clamp-2">
            {nombre}
        </div>

        <div className="flex items-center justify-between text-[11px]">
            {/* NF */}
            {typeof nf === "number" ? (
                <span className="inline-flex items-center gap-1 bg-white/70 rounded-full px-1.5 py-0.5 leading-none">
                    <span className="opacity-70">NF:</span> <span className="font-semibold">{nf.toFixed(1)}</span>
                </span>
            ) : <span />}

            {/* Créditos */}
            <span className="opacity-70">{creditos} SCT</span>
        </div>
    </div>
);
