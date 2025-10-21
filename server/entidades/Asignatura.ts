import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity()
export class Asignatura {
  @PrimaryColumn("text")
  codigo!: string; // Código como PK

  @Column("text")
  nombre!: string;

  @Column("int")
  creditos!: number;

  @Column("text", { array: true, nullable: true })
  prerrequisitos!: string[] | null; // ok inicializar como null si quieres, pero no necesario aquí
}
