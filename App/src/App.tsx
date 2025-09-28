import React, { useState } from "react";
import Form from "./pages/Login/Login";
import Malla from "./pages/AvanceCurricular/Malla";
import { LegendEstados } from "./componentes/avance/LegendEstados";
import { Sidebar } from "./componentes/layout/Sidebar";
import { PageHeader } from "./componentes/layout/PageHeader";

type Vista = "avance" | "historial" | "proyecciones";

const App: React.FC = () => {
    const [data, setData] = useState<any | null>(null);
    const handleSucces = (apiData: any) => setData(apiData);

    const [vista, setVista] = useState<Vista>("avance");
    const onLogout = () => window.location.reload();

    if (!data) return <Form onSucces={handleSucces} />;

    return (
        <div className="px-6 py-5 border-b border-white/10">
            <div className="text-sm opacity-80">Estudiante</div>
            <div className="text-base font-semibold leading-tight break-all">
            <Sidebar active={vista} onChange={setVista} onLogout={onLogout} nombre={data?.usuario?.email || data?.email || data?.correo || data?.rut} /> </div>
            <main className="ml-64 p-6">
                {vista === "avance" && (
                    <>
                        <PageHeader title="AVANCE CURRICULAR" />
                        <div className="mb-3">
                            <LegendEstados />
                        </div>
                        <Malla data={data} only="grid" />
                    </>
                )}

                {vista === "historial" && (
                    <>
                        <PageHeader title="HISTORIAL ACADÉMICO" />
                        {/* SOLO historial */}
                        <Malla data={data} only="historial" />
                    </>
                )}

                {vista === "proyecciones" && (
                    <>
                        <PageHeader title="PROYECCIONES" />
                        <div className="rounded-xl bg-white p-6 border text-slate-600">
                            Próximamente…
                        </div>
                    </>
                )}
            </main>
        </div>
    );

};

export default App;

