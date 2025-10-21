import { AppDataSource } from "../db";
import { Asignatura } from "../entidades/Asignatura";

const asignaturaRepo = AppDataSource.getRepository(Asignatura);

export const AsignaturaService = {
  async getAll() {
    return await asignaturaRepo.find();
  },

  async getById(id: number) {
    return await asignaturaRepo.findOne({ where: { id } });
  },

  async create(data: Partial<Asignatura>) {
    const asignatura = asignaturaRepo.create(data);
    return await asignaturaRepo.save(asignatura);
  },

  async update(id: number, data: Partial<Asignatura>) {
    await asignaturaRepo.update(id, data);
    return this.getById(id);
  },

  async remove(id: number) {
    return await asignaturaRepo.delete(id);
  },
};
