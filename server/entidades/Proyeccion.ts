import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Estudiante } from "./Estudiante";
import { Asignatura } from "./Asignatura";

@Entity()
export class Proyeccion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Estudiante, (estudiante) => estudiante.proyecciones)
  @JoinColumn({ name: "estudiante_rut" })
  estudiante!: Estudiante;

  @ManyToOne(() => Asignatura)
  @JoinColumn({ name: "asignatura_codigo" })
  asignatura!: Asignatura;
}
