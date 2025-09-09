import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...props }: InputProps) {
    return (
        <input
            className={`w-full bg-white border border-[var(--border)] rounded-md px-3 py-2
                  placeholder:text-[var(--muted)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--link)]
                  transition ${className}`}
            {...props}
        />
    );
}
