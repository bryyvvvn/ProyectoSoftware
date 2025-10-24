import "reflect-metadata"; // debe ir primero
import express from "express";
import cors from "cors";
import { AppDataSource } from "./db";

const app = express();
app.use(express.json());
app.use(cors());

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    // LOGIN
    app.post("/api/login", async (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Faltan username o password" });

      try {
        const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(401).json({ error: data.error });
        return res.json(data);
      } catch (err) {
        console.error("Error en el proxy /api/login:", err);
        return res.status(500).json({ error: "Error en el servidor proxy" });
      }
    });

    // MALLA
    app.get("/api/malla/:codigo/:catalogo", async (req, res) => {
      const { codigo, catalogo } = req.params;
      try {
        const queryParam = `${codigo}-${catalogo}`;
        const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${encodeURIComponent(queryParam)}`;
        const response = await fetch(url, { headers: { "X-HAWAII-AUTH": "jf400fejof13f" } });
        const data = await response.json();
        const cursos = Array.isArray(data) ? data : data.malla || data.data || [];
        console.log("✅ Cursos enviados al frontend:", cursos.length);
        return res.json(cursos);
      } catch (err) {
        console.error("Error al obtener la malla:", err);
        return res.status(500).json({ error: "Error al obtener la malla" });
      }
    });

    // HISTORIAL
    app.get("/api/historial/:rut/:codcarrera", async (req, res) => {
      const { rut, codcarrera } = req.params;
      try {
        const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${encodeURIComponent(rut)}&codcarrera=${encodeURIComponent(codcarrera)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || data?.error) return res.status(404).json({ error: data?.error || "No se pudo obtener el historial académico" });
        console.log("✅ Registros de historial enviados:", Array.isArray(data) ? data.length : 0);
        res.json(data);
      } catch (err) {
        console.error("Error al obtener avance académico:", err);
        res.status(500).json({ error: "Error al obtener avance académico" });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`✅ Servidor escuchando en http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Error iniciando servidor con DB:", err);
  }
}

main();
