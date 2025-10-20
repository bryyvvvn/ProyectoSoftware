import express from "express";
import type { Request, Response } from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors()); 


//LOGIN
app.post("/api/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Faltan username o password" });
  }

  try {
    const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`;

    console.log("Llamando a:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("Respuesta del endpoint UCN:", data);

    if (data.error) {
      return res.status(401).json({ error: data.error });
    }

    return res.json(data);
  } catch (err) {
    console.error("Error en el proxy /api/login:", err);
    return res.status(500).json({ error: "Error en el servidor proxy" });
  }
});


//MALLA 
app.get("/api/malla/:codigo/:catalogo", async (req: Request, res: Response) => {
  // El frontend debe solicitar: /api/malla/:codigo_carrera/:catalogo
  const { codigo, catalogo } = req.params;

  try {
    const queryParam = `${codigo}-${catalogo}`;
    const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${encodeURIComponent(queryParam)}`;

    console.log("Llamando a malla:", url);

    const response = await fetch(url, {
      headers: { "X-HAWAII-AUTH": "jf400fejof13f" },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error HTTP al obtener malla:", response.statusText);
      return res.status(response.status).json({ error: "No se pudo obtener la malla" });
    }

    // La API real devuelve un array directamente
    // Aseguramos que 'cursos' sea un array para el frontend
    const cursos = Array.isArray(data) ? data : data.malla || data.data || [];

    console.log("✅ Cursos enviados al frontend:", cursos.length);
    // IMPORTANTE: Devolvemos el array de cursos directamente
    return res.json(cursos);
  } catch (err) {
    console.error("Error al obtener la malla:", err);
    return res.status(500).json({ error: "Error al obtener la malla" });
  }
});


//HISTORIAL 
app.get("/api/historial/:rut/:codcarrera", async (req: Request, res: Response) => {
  // El frontend debe solicitar: /api/historial/:rut/:codigo_carrera
  const { rut, codcarrera } = req.params;

  try {
    const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${encodeURIComponent(
      rut
    )}&codcarrera=${encodeURIComponent(codcarrera)}`;

    console.log("Llamando a avance (historial):", url);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data?.error) {
      console.warn("Error del endpoint avance:", data?.error || response.statusText);
      return res.status(404).json({ error: data?.error || "No se pudo obtener el historial académico" });
    }

    console.log("✅ Registros de historial enviados:", Array.isArray(data) ? data.length : 0);
    // Devolvemos la respuesta, que es un array de registros
    res.json(data); 
  } catch (err) {
    console.error("Error al obtener avance académico:", err);
    res.status(500).json({ error: "Error al obtener avance académico" });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Servidor proxy escuchando en http://localhost:${PORT}`));