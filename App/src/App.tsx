import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Páginas
import Login from "./pages/Login/Login";
import Malla from "./pages/AvanceCurricular/Malla";
import Historial from "./pages/HistorialAcademico/Historial";
import Proyecciones from "./pages/Proyecciones/Proyecciones";
// IMPORTANTE: Verifica que esta ruta exista. Si tu archivo está en "pages/Perfil.tsx", borra "/Perfil" del final.
import Perfil from "./pages/Perfil/Perfil"; 

// Componentes de layout
import { Sidebar } from "./componentes/layout/Sidebar";

// Tipos
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

interface UserData {
  rut: string;
  carreras: Carrera[];
  email?: string;
  usuario?: { email: string };
  correo?: string;
}

const App: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);

  const handleSucces = (apiData: any) => setUserData(apiData as UserData);
  const onLogout = () => setUserData(null);
    
  return (
    <BrowserRouter>
      <Routes>
        {/* Si no hay sesión, mostrar login */}
        {!userData && (
          <Route path="/login" element={<Login onSucces={handleSucces} />} />
        )}

        {/* Si intenta acceder a otra ruta sin login, redirigir al login */}
        {!userData && <Route path="*" element={<Navigate to="/login" replace />} />}

        {/* Si hay sesión, mostrar la aplicación */}
        {userData && (
          <Route
            path="/*"
            element={
              <div className="flex min-h-screen bg-gray-900 font-sans text-white">
                <Sidebar
                  nombre={
                    userData.usuario?.email ||
                    userData.email ||
                    userData.correo ||
                    userData.rut ||
                    "Estudiante"
                  }
                  onLogout={onLogout}
                />
                <main className="flex-1 ml-64 p-8 bg-gray-300 text-gray-800">
                  <Routes>
                    <Route path="/" element={<Navigate to="/malla" replace />} />
                    <Route path="/malla" element={<Malla data={userData} />} />
                    <Route path="/historial" element={<Historial data={userData} />} />
                    <Route path="/proyecciones" element={<Proyecciones data={userData} />} />
                    
                    {/* AQUÍ ESTÁ LA RUTA DEL PERFIL */}
                    {/* Si no pones esto, al hacer click en el Sidebar te redirigirá a la malla */}
                    <Route path="/perfil" element={<Perfil data={userData} />} />

                    {/* Ruta por defecto para cualquier URL desconocida */}
                    <Route path="*" element={<Navigate to="/malla" replace />} />
                  </Routes>
                </main>
              </div>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default App;