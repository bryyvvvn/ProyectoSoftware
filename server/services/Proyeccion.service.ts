import { AppDataSource } from "../db";
import { Proyeccion } from "../entidades/Proyeccion";

const proyeccionRepo = AppDataSource.getRepository(Proyeccion);

export const ProyeccionService = {
  async getAll() {
    return await proyeccionRepo.find({ relations: ["estudiante", "asignaturas", "asignaturas.asignatura"] });
  },

  async getById(id: number) {
    return await proyeccionRepo.findOne({
      where: { id },
      relations: ["estudiante", "asignaturas", "asignaturas.asignatura"],
    });
  },

  async create(data: Partial<Proyeccion>) {
    const proyeccion = proyeccionRepo.create(data);
    return await proyeccionRepo.save(proyeccion);
  },

  async update(id: number, data: Partial<Proyeccion>) {
    await proyeccionRepo.update(id, data);
    return this.getById(id);
  },

  async remove(id: number) {
    return await proyeccionRepo.delete(id);
  },
};
