import { FC } from "react";

export const LegendEstados: FC = () => (
    <div className="flex items-center gap-4 text-sm text-slate-700">
        <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
            <span>Aprobado</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
            <span>Inscrito</span>
        </div>
    </div>
);
