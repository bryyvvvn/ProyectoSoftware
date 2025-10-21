import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { Estudiante } from "./entidades/Estudiante";
import { Proyeccion } from "./entidades/Proyeccion";
import { Asignatura } from "./entidades/Asignatura";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: ["error"],
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : false,
  entities: [Estudiante, Proyeccion, Asignatura],
});
