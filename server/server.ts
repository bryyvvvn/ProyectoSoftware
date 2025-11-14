import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AppDataSource } from "./db";
import routes from "./routes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(routes);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log("✅ Conectado a Neon PostgreSQL");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar el servidor", error);
    process.exit(1);
  }
};

startServer();
