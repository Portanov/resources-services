import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export type BiologicalSex = 'male' | 'female';
export type MenstrualPhase =
  | 'folicular'
  | 'ovulatoria'
  | 'lutea'
  | 'menstrual'
  | 'none';

export class NutricionalCalculationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  pesoKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(260)
  alturaCm!: number;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(120)
  edad!: number;

  @IsIn(['male', 'female'])
  sexo!: BiologicalSex;

  @IsOptional()
  @IsIn(['folicular', 'ovulatoria', 'lutea', 'menstrual', 'none'])
  faseMenstrual?: MenstrualPhase;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  embarazo?: boolean;

  @ValidateIf((o: NutricionalCalculationDto) => o.embarazo === true)
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3])
  trimestreEmbarazo?: 1 | 2 | 3;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(300)
  ajusteFaseLuteaKcal?: number;
}
