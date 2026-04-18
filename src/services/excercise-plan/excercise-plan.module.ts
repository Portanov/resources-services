import { Module } from "@nestjs/common";
import { ExercisePlanController } from "./excercise-plan.controller";
import { ExercisePlanOrchestratorService } from "./exercise-plan-orchestrator.service";
import { FiltroFisicoService } from "./excercise-plan.service";
import { RepositoryRecipesModule } from "../repository-recipes/repository-recipes.module";
import { GeminiClientService } from "../clinical-filter/gemini-client.service";
import { MongooseModule } from "@nestjs/mongoose";
import { PlanEjercicio, PlanEjercicioSchema } from "./schemas/excercise-plan.schema";
import { GymModule } from "../plans/gym.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PlanEjercicio.name, schema: PlanEjercicioSchema }]),
    GymModule
  ],
  controllers: [ExercisePlanController], // <-- ¡Este es el paso clave aquí!
  providers: [ExercisePlanOrchestratorService, GeminiClientService],
  exports: [ExercisePlanOrchestratorService],
})
export class ExercisePlanModule {}