import { Body, Controller, Post } from '@nestjs/common';
import type { NutricionalCalculationResult } from './nutricional-calculator.service';
import { NutricionalCalculatorService } from './nutricional-calculator.service';
import { NutricionalCalculationDto } from './dto/nutricional-calculation.dto';

@Controller('rest/nutricional-calculator')
export class NutricionalCalculatorController {
  constructor(private readonly service: NutricionalCalculatorService) {}

  @Post('calculate')
  calculate(
    @Body() input: NutricionalCalculationDto,
  ): NutricionalCalculationResult {
    return this.service.calculate(input);
  }
}
