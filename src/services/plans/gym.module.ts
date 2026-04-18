import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DietPlan, DietPlanSchema } from './schemas/plan.schema';
import { GymPlanService } from './gym.service';
import { ExercisePlan, ExercisePlanSchema } from './schemas/gym-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExercisePlan.name, schema: ExercisePlanSchema },
    ]),
  ],
  providers: [GymPlanService],
  exports: [GymPlanService],
})
export class GymModule {}
