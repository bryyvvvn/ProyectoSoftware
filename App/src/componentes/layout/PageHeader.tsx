import { FC, ReactNode } from "react";

export const PageHeader: FC<{ title: string; right?: ReactNode }> = ({ title, right }) => (
    <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide">{title}</h1>
        {right}
    </div>
);
