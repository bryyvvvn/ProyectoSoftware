import React from "react";

export default function Card({
                                 className = "",
                                 children,
                             }: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={`relative bg-[var(--panel)] rounded-[var(--radius)] border border-[var(--border)] p-6 ${className}`}
            style={{ boxShadow: "var(--shadow)" }}
        >
            {children}
        </div>
    );
}
