import "reflect-metadata";
import express from "express";
import cors from "cors";
import { AppDataSource } from "./db";
import routes from "./routes";

const app = express();
app.use(express.json());
app.use(cors());

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    app.use(routes);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`✅ Servidor en http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Error iniciando servidor:", err);
  }
}

main();
