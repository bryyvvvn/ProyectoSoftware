import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AppDataSource } from "./db";
import routes from "./routes";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(routes);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    app.listen(PORT, () => {
      console.log(`✅ Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error iniciando servidor con DB:", error);
  }
}

bootstrap();
