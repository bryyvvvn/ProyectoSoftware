import { Asignatura } from "../entidades/Asignatura";
import { ProyeccionAsignatura } from "../entidades/Proyeccion_Asignatura";

// Representa una asignación junto con su información de curso asociada.
// Se mantiene como tipo aparte para reutilizarla en validadores y servicios
// sin acoplarlos directamente a la implementación concreta de la entidad.
export type AssignmentWithCourse = ProyeccionAsignatura & { asignatura: Asignatura };