import React, { useState, ChangeEvent, FormEvent } from "react";
import "./styles/login.css";

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

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setResult("");
        try {
            const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${encodeURIComponent(
                form.username
            )}&password=${encodeURIComponent(form.password)}`;
            const response = await fetch(url, { method: "GET" });
            const data = await response.json();
            if (data && !data.error) {
                onSucces(data);
            } else {
                setResult(data.error || "Credenciales inválidas");
            }
        } catch (err) {
            console.error(err);
            setResult("Error en la solicitud");
        }
    };

    return (
        <div className="min-h-screen grid place-items-center px-4">
            <div className="container">
                <h1 className="heading">¡Bienvenido!</h1>

                <form className="form" onSubmit={handleSubmit}>
                    <input
                        className="input"
                        type="text"
                        name="username"
                        placeholder="usuario@ucn.cl"
                        value={form.username}
                        onChange={handleChange}
                    />

                    <input
                        className="input"
                        type="password"
                        name="password"
                        placeholder="Contraseña"
                        value={form.password}
                        onChange={handleChange}
                    />

                    <span className="forgot-password">
            <a href="#">¿Olvidaste tu contraseña?</a>
          </span>

                    <button className="login-button" type="submit">
                        Iniciar sesión
                    </button>
                </form>

                {result && (
                    <div
                        style={{
                            background: "var(--panel-2)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: "10px 12px",
                            fontSize: 13,
                            marginTop: 8,
                        }}
                    >
                        {result}
                    </div>
                )}

                <div className="social-account-container">
                    <span className="title">o bien ingresa con</span>
                    <div className="social-accounts">
                        <button className="social-button" type="button" aria-label="Google">
                            <svg className="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
                                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.4 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.3 16 18.8 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6 29.4 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
                                <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.2 26.8 36 24 36c-5.3 0-9.7-3.6-11.3-8.5l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
                                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-4.5 5.5-8.3 5.5-5.3 0-9.7-3.6-11.3-8.5l-6.5 5C9.6 39.6 16.3 44 24 44c11.1 0 20-8.9 20-20 0-1.3-.1-2.7-.4-3.5z"/>
                            </svg>
                        </button>
                        {/* Agrega otros si quieres: GitHub/Twitter */}
                    </div>
                </div>

                <span className="agreement">
          ¿No tienes cuenta? <a href="#">Regístrate</a>
        </span>
            </div>
        </div>
    );
}
