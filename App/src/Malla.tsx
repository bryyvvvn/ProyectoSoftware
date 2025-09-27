import React, { useEffect, useState } from "react";

interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

interface MallaProps {
  data: {
    rut: string;
    carreras: Carrera[];
  };
}

interface Curso {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
}

const Malla: React.FC<MallaProps> = ({ data }) => {
  const [mallas, setMallas] = useState<{ [key: string]: Curso[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMallas = async () => {
      setLoading(true);
      setError(null);
      const nuevasMallas: { [key: string]: Curso[] } = {};

      try {
        for (const carrera of data.carreras) {
          const response = await fetch(
            `/api/mallas/${carrera.codigo}/${carrera.catalogo}`
          );

          if (!response.ok) {
            throw new Error(`Error cargando malla de ${carrera.nombre}`);
          }

          const cursos: Curso[] = await response.json();
          nuevasMallas[carrera.nombre] = cursos;
        }

        setMallas(nuevasMallas);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al cargar mallas");
      } finally {
        setLoading(false);
      }
    };

    fetchMallas();
  }, [data.carreras]);

  if (loading) return <p className="text-center mt-10">Cargando mallas...</p>;
  if (error)
    return (
      <p className="text-center mt-10 text-red-500 font-semibold">{error}</p>
    );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Mallas de {data.rut}
      </h1>

      {data.carreras.map((carrera) => (
        <div key={carrera.codigo} className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{carrera.nombre}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mallas[carrera.nombre]?.map((curso) => (
              <div
                key={curso.codigo}
                className="bg-white border rounded-lg p-4 shadow hover:shadow-md transition"
              >
                <h3 className="font-semibold">{curso.asignatura}</h3>
                <p className="text-sm text-gray-600">
                  Código: {curso.codigo}
                </p>
                <p className="text-sm text-gray-600">
                  Créditos: {curso.creditos} | Nivel: {curso.nivel}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Malla;
