import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { Proyeccion } from "./Proyeccion";

@Entity({ name: "estudiante" })
export class Estudiante {
  @PrimaryColumn("varchar")
  rut!: string; // RUT como PK

  @Column("varchar")
  email!: string;

  @Column("varchar")
  nombre!: string;

  @OneToMany(() => Proyeccion, (proyeccion) => proyeccion.estudiante)
  proyecciones!: Proyeccion[];
}
