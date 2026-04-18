import { Type } from 'class-transformer';
import {
  Allow,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export type SexoBiologicoDto = 'masculino' | 'femenino';
export type TipoDietaDto =
  | 'omnivora'
  | 'vegetariana'
  | 'vegana'
  | 'mediterranea'
  | 'keto';
export type ObjetivoDietaDto = 'bajar_peso' | 'subir_peso' | 'mantener';
export type FrecuenciaEntrenamientoDto = '1_2' | '3_4' | '5_plus';
export type HorasEntrenamientoDiarioDto = '30min' | '1hr' | '2hrs' | 'flexible';
export type MetaNutricionalFrontDto = string | number;
export type ControlCaloriasFrontDto = string | number;
export type PreparacionComidaFrontDto = string | number;

export class PerfilFisicoDto {
  @Type(() => Number)
  @IsInt()
  @Min(10)
  edad!: number;

  @Type(() => Number)
  @IsInt()
  @Min(20)
  peso_kg!: number;

  @Type(() => Number)
  @IsInt()
  @Min(80)
  altura_cm!: number;

  @IsIn(['masculino', 'femenino'])
  sexo_biologico!: SexoBiologicoDto;
}

export class PerfilClinicoDto {
  @IsOptional()
  @IsIn(['bajar_peso', 'subir_peso', 'mantener'])
  objetivo?: ObjetivoDietaDto;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ each: false })
  enfermedades_cronicas?: string[];

  @IsOptional()
  @IsArray()
  alergias?: string[];

  @IsOptional()
  @IsArray()
  medicamentos?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  fuma?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  consume_alcohol?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  embarazo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trimestre_embarazo?: 1 | 2 | 3;

  @IsOptional()
  @IsIn(['folicular', 'ovulatoria', 'lutea', 'menstrual', 'none'])
  fase_menstrual?: 'folicular' | 'ovulatoria' | 'lutea' | 'menstrual' | 'none';
}

export class EstiloVidaDto {
  @IsIn(['1_2', '3_4', '5_plus'])
  frecuencia_ejercicio_semana!: FrecuenciaEntrenamientoDto;

  @IsIn(['30min', '1hr', '2hrs', 'flexible'])
  horas_entrenamiento_diario!: HorasEntrenamientoDiarioDto;
}

export class PreferenciasDietaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  comidas_por_dia!: number;

  @IsOptional()
  @IsArray()
  excluir_ingredientes_gusto?: string[];

  @IsIn(['omnivora', 'vegetariana', 'vegana', 'mediterranea', 'keto'])
  tipo_dieta!: TipoDietaDto;

  @IsOptional()
  @Allow()
  meta_nutricional?: MetaNutricionalFrontDto;

  @IsOptional()
  @Allow()
  control_calorias?: ControlCaloriasFrontDto;

  @IsOptional()
  @Allow()
  preparacion_comida?: PreparacionComidaFrontDto;
}

export class SolicitudPlanDietaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuario_id!: number;

  @ValidateNested()
  @Type(() => PerfilFisicoDto)
  perfil_fisico!: PerfilFisicoDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PerfilClinicoDto)
  perfil_clinico?: PerfilClinicoDto | null;

  @ValidateNested()
  @Type(() => PreferenciasDietaDto)
  preferencias_dieta!: PreferenciasDietaDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EstiloVidaDto)
  estilo_vida?: EstiloVidaDto;
}
