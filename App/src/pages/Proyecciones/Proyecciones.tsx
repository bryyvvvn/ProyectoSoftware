import React from "react";


interface Carrera { codigo: string; nombre: string; catalogo: string; }
interface UserData { 
    rut: string; 
    carreras: Carrera[]; 
    // ... otros campos
}

// 1. Interfaz de Props Corregida: Ahora espera 'data'
interface ProyeccionesProps {
    data: UserData; 
}

// 2. Desestructuración de Props Corregida
const ProyeccionesPage: React.FC<ProyeccionesProps> = ({ data }) => { // 👈 CORRECCIÓN 

    return (
        <>
            {/* ... */}
            <div className="rounded-xl bg-gray-100 p-6 border text-slate-600 shadow-md">
                Próximamente... Proyección para el estudiante: {data.rut}
            </div>
        </>
    );
};

export default ProyeccionesPage;