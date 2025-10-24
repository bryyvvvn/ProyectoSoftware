import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity({ name: "asignatura" })
export class Asignatura {
  @PrimaryColumn("varchar")
  codigo!: string; // Código como PK

  @Column("varchar")
  nombre!: string;

  @Column("int")
  creditos!: number;

  @Column("int")
  nivel!: number;

  @Column("text", { array: true, nullable: true })
  prereq!: string[] | null; // Array de códigos de asignaturas prerequisito

  @Column("varchar")
  catalogo!: string;
}
