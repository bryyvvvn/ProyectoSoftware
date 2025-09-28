import { FC, ReactNode } from "react";

export const SemesterColumn: FC<{ roman: string; children: ReactNode }> = ({ roman, children }) => (
    <div className="min-w-[200px] max-w-[220px]">
        <div className="mx-1 mb-2">
            <div className="bg-[var(--semester-head,#0f172a)] text-white rounded-md px-3 py-1.5 text-sm text-center font-semibold">
                {roman}
            </div>
        </div>
        <div className="space-y-2 px-1">{children}</div>
    </div>
);

