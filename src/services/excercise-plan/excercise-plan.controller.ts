import { Body, Controller, Post } from '@nestjs/common';
import { ExercisePlanOrchestratorService } from './exercise-plan-orchestrator.service';
import type { GeminiExercisePayload } from './exercise-plan-orchestrator.service';
import { SolicitudPlanEjercicioDto } from './dto/exercise-plan-request.dto';

@Controller('rest/exercise-plan')
export class ExercisePlanController {
  constructor(
    private readonly exercisePlanOrchestratorService: ExercisePlanOrchestratorService,
  ) {}

  @Post('ejercicios')
  construirPlan(
    @Body() solicitud: SolicitudPlanEjercicioDto,
  ): GeminiExercisePayload {
    return this.exercisePlanOrchestratorService.construirPayloadGemini(
      solicitud,
    );
  }

  @Post('ejercicios/gemini')
  async construirPlanYGenerar(@Body() solicitud: SolicitudPlanEjercicioDto) {
    return this.exercisePlanOrchestratorService.construirYGenerarConGemini(
      solicitud,
    );
  }
}