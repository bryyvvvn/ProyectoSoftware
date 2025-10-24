import { AppDataSource } from "../db";
import { ProyeccionAsignatura } from "../entidades/Proyeccion_Asignatura";

const proyeccionAsigRepo = AppDataSource.getRepository(ProyeccionAsignatura);

export const ProyeccionAsignaturaService = {
  async getAll() {
    return await proyeccionAsigRepo.find({ relations: ["proyeccion", "asignatura"] });
  },

  async getById(id: number) {
    return await proyeccionAsigRepo.findOne({
      where: { id },
      relations: ["proyeccion", "asignatura"],
    });
  },

  async create(data: Partial<ProyeccionAsignatura>) {
    const proyAsig = proyeccionAsigRepo.create(data);
    return await proyeccionAsigRepo.save(proyAsig);
  },

  async update(id: number, data: Partial<ProyeccionAsignatura>) {
    await proyeccionAsigRepo.update(id, data);
    return this.getById(id);
  },

  async remove(id: number) {
    return await proyeccionAsigRepo.delete(id);
  },
};
