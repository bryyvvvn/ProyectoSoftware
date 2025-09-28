import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
};

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
    const base =
        "inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white",
        secondary: "bg-[var(--brand-900)] hover:bg-[var(--brand-700)] text-white",
        ghost: "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-2)]",
    } as const;

    return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
