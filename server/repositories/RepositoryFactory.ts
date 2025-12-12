import { DataSource, Repository } from "typeorm";
import { Asignatura } from "../entidades/Asignatura";
import { Estudiante } from "../entidades/Estudiante";
import { Proyeccion } from "../entidades/Proyeccion";
import { ProyeccionAsignatura } from "../entidades/Proyeccion_Asignatura";

export interface RepositoryFactoryPort {
  createAsignaturaRepository(): Repository<Asignatura>;
  createProyeccionRepository(): Repository<Proyeccion>;
  createProyeccionAsignaturaRepository(): Repository<ProyeccionAsignatura>;
  createEstudianteRepository(): Repository<Estudiante>;
}

export class RepositoryFactory implements RepositoryFactoryPort {
  constructor(private readonly dataSource: DataSource) {}

  createAsignaturaRepository(): Repository<Asignatura> {
    return this.dataSource.getRepository(Asignatura);
  }

  createProyeccionRepository(): Repository<Proyeccion> {
    return this.dataSource.getRepository(Proyeccion);
  }

  createProyeccionAsignaturaRepository(): Repository<ProyeccionAsignatura> {
    return this.dataSource.getRepository(ProyeccionAsignatura);
  }

  createEstudianteRepository(): Repository<Estudiante> {
    return this.dataSource.getRepository(Estudiante);
  }
}