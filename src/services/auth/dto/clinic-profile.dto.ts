import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type {
  NivelActividad,
  ObjetivoClinico,
  SexoBiologico,
} from '../entities/clinic-profile.entity';

export class CreateClinicProfileDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(499)
  pesoKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(299)
  alturaCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  edad?: number;

  @IsOptional()
  @IsIn(['male', 'female'])
  sexo?: SexoBiologico;

  @IsOptional()
  @IsIn([
    'sedentario',
    'ligeramente_activo',
    'moderado',
    'activo',
    'muy_activo',
  ])
  nivelActividad?: NivelActividad;

  @IsOptional()
  @IsIn([
    'perdida_grasa',
    'ganancia_muscular',
    'mantenimiento',
    'rendimiento',
    'salud_general',
    'rehabilitacion',
  ])
  objetivo?: ObjetivoClinico;

  @IsOptional()
  @IsObject()
  condicionFemenina?: Record<string, unknown>;

  @IsOptional()
  enfermedades?: unknown[];

  @IsOptional()
  alergias?: unknown[];

  @IsOptional()
  medicamentos?: unknown[];

  @IsOptional()
  @IsObject()
  biomarcadores?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  preferenciasLogistica?: Record<string, unknown>;

  // Datos usados por el servicio de plan de ejercicios
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  haceEjercicio?: boolean;

  @IsOptional()
  @IsIn(['1-2 días', '3-4 días', '5-6 días', 'Todos los días'])
  diasPorSemana?: string;

  @IsOptional()
  @IsIn(['Principiante', 'Intermedio', 'Avanzado'])
  nivelActual?: string;

  @IsOptional()
  @IsIn([
    'Tonificación muscular',
    'Fuerza y potencia',
    'Resistencia cardio',
    'Flexibilidad y movilidad',
  ])
  metaPrincipal?: string;

  @IsOptional()
  @IsIn(['Gimnasio', 'En casa', 'Al aire libre', 'Mixto'])
  lugarPreferido?: string;
}

export class DeleteClinicProfileDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
