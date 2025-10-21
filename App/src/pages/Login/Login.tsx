import React, { useState, ChangeEvent, FormEvent } from "react";

// Interfaz para definir la estructura de los datos del formulario
interface LoginFormData {
    username: string;
    password: string;
}

// Interfaz para definir las props del componente
interface LoginProps {
    onSucces: (data: any) => void;
}

export default function Form({ onSucces }: LoginProps) {
    // Estado para almacenar los datos del formulario (usuario y contraseña)
    const [form, setForm] = useState<LoginFormData>({ username: "", password: "" });
    // Estado para almacenar el mensaje de resultado (éxito o error)
    const [result, setResult] = useState<string>("");

    // Manejador para actualizar el estado del formulario cuando el usuario escribe
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Manejador para enviar el formulario
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setResult(""); // Limpiar el resultado anterior

        try {
            // Petición POST al endpoint de login
            const response = await fetch("http://localhost:3000/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            console.log("Respuesta del servidor:", data);

            if (response.ok) {
                // Si la respuesta es exitosa, llama a la función onSucces
                onSucces(data); // data incluye el token o info del usuario
            } else {
                // Si hay un error, muestra el mensaje de error
                setResult(data.error || "Credenciales inválidas");
            }
        } catch (err) {
            console.error(err);
            setResult("Error en la solicitud");
        }
    };

    return (
        // Contenedor principal que centra el formulario en la pantalla
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 dark">
            <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-200 mb-4">Iniciar Sesión</h2>

                <form className="flex flex-col" onSubmit={handleSubmit}>
                    {/* Campo de entrada para el email/usuario */}
                    <input
                        placeholder="Correo electrónico"
                        className="bg-gray-700 text-gray-200 border-0 rounded-md p-2 mb-4 focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition ease-in-out duration-150"
                        type="email"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        required
                    />

                    {/* Campo de entrada para la contraseña */}
                    <input
                        placeholder="Contraseña"
                        className="bg-gray-700 text-gray-200 border-0 rounded-md p-2 mb-4 focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition ease-in-out duration-150"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />

                    <div className="flex items-center justify-between flex-wrap">
                        {/* Checkbox "Remember me" (sin funcionalidad por ahora) */}
                        <label className="text-sm text-gray-200 cursor-pointer" htmlFor="remember-me">
                            <input className="mr-2" id="remember-me" type="checkbox" />
                            Recuérdame
                        </label>

                        {/* Enlace para recuperar contraseña */}
                        <a className="text-sm text-blue-500 hover:underline mb-0.5" href="#">¿Olvidaste tu contraseña?</a>
                    </div>

                    {/* Botón para enviar el formulario */}
                    <button
                        className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold py-2 px-4 rounded-md mt-4 hover:bg-indigo-600 hover:to-blue-600 transition ease-in-out duration-150"
                        type="submit"
                    >
                        Iniciar Sesión
                    </button>

                    {/* Muestra el mensaje de error si existe */}
                    {result && (
                        <p className="text-red-400 text-center mt-4 text-sm">
                            {result}
                        </p>
                    )}
                </form>

                {/* Enlace para registrarse */}
                <p className="text-gray-200 mt-4 text-center text-sm">
                    ¿No tienes una cuenta? <a className="text-sm text-blue-500 hover:underline" href="#">Regístrate</a>
                </p>
            </div>
        </div>
    );
}


