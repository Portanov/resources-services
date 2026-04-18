import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, isValidObjectId, Model } from 'mongoose';
import { ExercisePlan, ExercisePlanDocument } from './schemas/gym-plan.schema';

@Injectable()
export class GymPlanService {
  constructor(
    @InjectModel(ExercisePlan.name) private exercisePlanModel: Model<ExercisePlanDocument>,
  ) {}

  async saveExercisePlan(data: any): Promise<ExercisePlanDocument> {
    const newPlan = new this.exercisePlanModel(data);
    return newPlan.save();
  }

  async getExercisePlanByUser(userId: string): Promise<ExercisePlanDocument> {
    const plan = await this.exercisePlanModel
      .findOne({ usuario_id: userId })
      .sort({ createdAt: -1 }) 
      .exec();

    if (!plan) {
      throw new NotFoundException('No se encontró un plan de ejercicios para este usuario');
    }
    
    return plan;
  }

  async eliminateExercisePlan(userId: string): Promise<DeleteResult> {
    const result = await this.exercisePlanModel
      .deleteMany({ usuario_id: userId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('No se encontraron planes de ejercicio para eliminar');
    }

    return result;
  }

  async getExercisePlanByUserId(userId: string): Promise<ExercisePlanDocument> {
    const plan = await this.exercisePlanModel
      .findOne({ usuario_id: userId }) // Filtra por el campo de usuario
      .sort({ createdAt: -1 })        // Trae el más reciente
      .exec();

    if (!plan) {
      throw new NotFoundException(`No se encontró un plan de ejercicios para el usuario: ${userId}`);
    }
    
    return plan;
  }
}