import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from "typeorm";
import { Proyeccion } from "./Proyeccion";
import { Asignatura } from "./Asignatura";

@Entity({ name: "proyeccion_asignatura" })
export class ProyeccionAsignatura {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Proyeccion, (proyeccion) => proyeccion.asignaturas, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "proyeccion_id" })
  proyeccion!: Proyeccion;

  @ManyToOne(() => Asignatura)
  @JoinColumn({ name: "asignatura_codigo" })
  asignatura!: Asignatura;

  @Column("varchar", { default: "proyectado" })
  estado!: string;

  @Column("int", { nullable: true })
  semestre!: number | null;
}
