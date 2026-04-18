import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DietPlan, DietPlanSchema } from './schemas/plan.schema';
import { GymPlanService } from './gym.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DietPlan.name, schema: DietPlanSchema },
    ]),
  ],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
