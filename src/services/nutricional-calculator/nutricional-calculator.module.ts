import { Module } from '@nestjs/common';
import { NutricionalCalculatorController } from './nutricional-calculator.controller';
import { NutricionalCalculatorService } from './nutricional-calculator.service';

@Module({
    imports: [],
    providers: [NutricionalCalculatorService],
    exports: [NutricionalCalculatorService],
    controllers: [NutricionalCalculatorController],
})
export class NutricionalCalculatorModule { }
