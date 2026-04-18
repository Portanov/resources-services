import { Module } from '@nestjs/common';
import { ExercisePlanController } from './excercise-plan.controller';
import { ExercisePlanOrchestratorService } from './exercise-plan-orchestrator.service';
import { GeminiClientService } from '../clinical-filter/gemini-client.service';
import { MongooseModule } from '@nestjs/mongoose';
import { PlanEjercicio, PlanEjercicioSchema } from './schemas/excercise-plan.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlanEjercicio.name, schema: PlanEjercicioSchema },
    ]),
    AuthModule,
  ],
  controllers: [ExercisePlanController],
  providers: [ExercisePlanOrchestratorService, GeminiClientService],
  exports: [ExercisePlanOrchestratorService],
})
export class ExercisePlanModule {}