import { AppDataSource } from "../db";
import { Estudiante } from "../entidades/Estudiante";

const estudianteRepo = AppDataSource.getRepository(Estudiante);

export const EstudianteService = {
  async getAll() {
    return await estudianteRepo.find({ relations: ["proyecciones"] });
  },

  async getById(rut: string) {
    return await estudianteRepo.findOne({
      where: { rut },
      relations: ["proyecciones"],
    });
  },

  async create(data: Partial<Estudiante>) {
    const estudiante = estudianteRepo.create(data);
    return await estudianteRepo.save(estudiante);
  },

  async update(rut: string, data: Partial<Estudiante>) {
    await estudianteRepo.update(rut, data);
    return this.getById(rut);
  },

  async remove(rut: string) {
    return await estudianteRepo.delete(rut);
  },
};
