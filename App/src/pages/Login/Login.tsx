import React, { useState, ChangeEvent, FormEvent } from "react";
import logoImg from './logo.png';

interface LoginFormData {
    username: string;
    password: string;
}

interface LoginProps {
    onSucces: (data: any) => void;
}

export default function Form({ onSucces }: LoginProps) {
    const [form, setForm] = useState<LoginFormData>({ username: "", password: "" });
    const [result, setResult] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setResult("");
        setIsLoading(true);

        try {
            const response = await fetch("http://localhost:3000/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await response.json();

            if (response.ok) {
                onSucces(data);
            } else {
                setResult(data.error || "Credenciales inválidas");
            }
        } catch (err) {
            console.error(err);
            setResult("Error de conexión con el servidor");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // 1. FONDO BLANCO GENERAL
        <div className="flex min-h-screen items-center justify-center bg-gray-300 px-4">

            {/* 2. TARJETA CON EL AZUL INSTITUCIONAL (#0e3a53) */}
            <div
                className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{ backgroundColor: "#0e3a53" }}
            >

                {/* Encabezado */}
                <div className="mb-8 text-center">

                    {/* --- AQUÍ ESTÁ EL LOGO CON EL CÍRCULO DE CONTRASTE --- */}
                    {/* Usamos 'bg-white/10' para crear ese contraste sutil pero efectivo sobre el azul */}
                    {/* Aumenté el tamaño a 'h-24 w-24' (aprox 96px) para que el logo destaque más */}
                    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 p-4 shadow-lg">
                        <img
                            src={logoImg}
                            alt="Logo Institucional"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    {/* ----------------------------------------------------- */}

                    <h2 className="text-3xl font-bold tracking-tight text-white">Bienvenido</h2>
                    <p className="mt-2 text-sm text-slate-300">Plataforma de Gestión Académica UCN</p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    {/* Input Usuario */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">Correo Electrónico</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <input
                                type="email"
                                name="username"
                                required
                                // Inputs con fondo oscuro semi-transparente
                                className="block w-full rounded-lg border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 sm:text-sm transition-colors"
                                placeholder="ejemplo@ucn.cl"
                                value={form.username}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Input Contraseña */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">Contraseña</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <input
                                type="password"
                                name="password"
                                required
                                className="block w-full rounded-lg border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 sm:text-sm transition-colors"
                                placeholder="••••••••"
                                value={form.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Botón de Acción (Naranja / Amber) */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex justify-center rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-amber-600 hover:shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-[#0e3a53] ${
                            isLoading ? "cursor-not-allowed opacity-70" : ""
                        }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Ingresando...
              </span>
                        ) : (
                            "Iniciar Sesión"
                        )}
                    </button>

                    {/* Mensaje de Error */}
                    {result && (
                        <div className="rounded-md bg-red-500/10 p-3 border border-red-500/20">
                            <p className="text-center text-sm font-medium text-red-300">
                                {result}
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
