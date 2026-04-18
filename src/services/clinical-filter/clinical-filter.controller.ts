import { Body, Controller, Post } from '@nestjs/common';
import { DietPlanOrchestratorService } from './diet-plan-orchestrator.service';
import type { GeminiDietPayload } from './diet-plan-orchestrator.service';
import { SolicitudPlanDietaDto } from './dto/diet-plan-request.dto';

@Controller('rest/clinical-filter')
export class ClinicalFilterController {
  constructor(
    private readonly dietPlanOrchestratorService: DietPlanOrchestratorService,
  ) {}

  @Post('plan')
  construirPlan(@Body() solicitud: SolicitudPlanDietaDto): GeminiDietPayload {
    return this.dietPlanOrchestratorService.construirPayloadGemini(solicitud);
  }

  @Post('plan/gemini')
  async construirPlanYGenerar(@Body() solicitud: SolicitudPlanDietaDto) {
    return this.dietPlanOrchestratorService.construirYGenerarConGemini(
      solicitud,
    );
  }
}
