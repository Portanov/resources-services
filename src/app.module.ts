import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClinicalFilterModule } from './services/clinical-filter/clinical-filter.module';
import { NutricionalCalculatorModule } from './services/nutricional-calculator/nutricional-calculator.module';

@Module({
  imports: [NutricionalCalculatorModule, ClinicalFilterModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
