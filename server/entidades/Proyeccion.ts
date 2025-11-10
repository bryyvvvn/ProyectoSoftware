import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
  Column,
} from "typeorm";
import { Estudiante } from "./Estudiante";
import { ProyeccionAsignatura } from "./Proyeccion_Asignatura";

@Entity({ name: "proyeccion" })
export class Proyeccion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Estudiante, (estudiante) => estudiante.proyecciones)
  @JoinColumn({ name: "estudiante_rut" })
  estudiante!: Estudiante;

  @CreateDateColumn({ name: "fecha_creacion" })
  fechaCreacion!: Date;

  @Column("varchar", {name: "nombre_version"})
  nombreVersion!: string;

  @Column("boolean", {name: "is_ideal", default: false})
  isIdeal!: boolean;

  @OneToMany(
    () => ProyeccionAsignatura,
    (proyAsig) => proyAsig.proyeccion,
    { cascade: true }
  )
  asignaturas!: ProyeccionAsignatura[];
}
