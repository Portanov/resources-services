import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model } from 'mongoose';
import { DietPlan, DietPlanDocument } from './schemas/plan.schema';

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(DietPlan.name) private dietPlanModel: Model<DietPlanDocument>,
  ) {}

  async saveDiet(data: any) {
    const newDiet = new this.dietPlanModel(data);
    return newDiet.save();
  }

  async getDietByUser(userId: string): Promise<DietPlanDocument> {
    const diet = await this.dietPlanModel
      .findOne({ usuario_id: userId })
      .sort({ createdAt: -1 })
      .exec();
    if (!diet) {
      throw new NotFoundException('No se encontro dieta');
    }
    return diet;
  }

  async eliminateDiet(userId: string): Promise<DeleteResult> {
    const result = await this.dietPlanModel
      .deleteOne({ usuario_id: userId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('No se encontro dieta para eliminar');
    }

    return result;
  }
}
