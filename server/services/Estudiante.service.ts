import { AppDataSource } from "../db";
import { Estudiante } from "../entidades/Estudiante";

const estudianteRepo = AppDataSource.getRepository(Estudiante);

export const EstudianteService = {
  async getAll() {
    return await estudianteRepo.find();
  },

  async getById(id: number) {
    return await estudianteRepo.findOne({ where: { id } });
  },

  async create(data: Partial<Estudiante>) {
    const estudiante = estudianteRepo.create(data);
    return await estudianteRepo.save(estudiante);
  },

  async update(id: number, data: Partial<Estudiante>) {
    await estudianteRepo.update(id, data);
    return this.getById(id);
  },

  async remove(id: number) {
    return await estudianteRepo.delete(id);
  },
};
