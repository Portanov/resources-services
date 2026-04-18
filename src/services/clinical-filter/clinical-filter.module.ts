import { Module } from '@nestjs/common';
import { ClinicalFilterController } from './clinical-filter.controller';
import { DietPlanOrchestratorService } from './diet-plan-orchestrator.service';
import { FiltroClinicoService } from './clinical-filter.service';
import { NutricionalCalculatorModule } from '../nutricional-calculator/nutricional-calculator.module';
import { RepositoryRecipesModule } from '../repository-recipes/repository-recipes.module';
import { GeminiClientService } from './gemini-client.service';
import { PlansModule } from '../plans/plans.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    NutricionalCalculatorModule,
    RepositoryRecipesModule,
    PlansModule,
    AuthModule,
  ],
  providers: [
    GeminiClientService,
    FiltroClinicoService,
    DietPlanOrchestratorService,
  ],
  controllers: [ClinicalFilterController],
})
export class ClinicalFilterModule {}
