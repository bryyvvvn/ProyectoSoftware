import { FC } from "react";

export const CareerBanner: FC<{ carrera: string }> = ({ carrera }) => (
    <div className="inline-block rounded-xl px-6 py-3 bg-[var(--banner-blue,#1e3a8a)] text-white font-medium shadow text-lg">
        {carrera}
    </div>
);

