import { AppDataSource } from "../db";
import { Asignatura } from "../entidades/Asignatura";

const asignaturaRepo = AppDataSource.getRepository(Asignatura);

export const AsignaturaService = {
  async getAll() {
    return await asignaturaRepo.find();
  },

  async getById(codigo: string) {
    return await asignaturaRepo.findOne({ where: { codigo } });
  },

  async create(data: Partial<Asignatura>) {
    const asignatura = asignaturaRepo.create(data);
    return await asignaturaRepo.save(asignatura);
  },

  async update(codigo: string, data: Partial<Asignatura>) {
    await asignaturaRepo.update(codigo, data);
    return this.getById(codigo);
  },

  async remove(codigo: string) {
    return await asignaturaRepo.delete(codigo);
  },
};
