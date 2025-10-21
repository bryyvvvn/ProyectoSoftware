import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { Proyeccion } from "./Proyeccion";

@Entity()
export class Estudiante {
  @PrimaryColumn("text")
  rut!: string; // RUT como PK

  @Column("text")
  nombre!: string;

  @Column("text")
  correo!: string;

  @OneToMany(() => Proyeccion, (proyeccion) => proyeccion.estudiante)
  proyecciones!: Proyeccion[]; // NO inicializar con = []
}
