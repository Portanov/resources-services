import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export type SexoBiologicoDto = 'masculino' | 'femenino';
export type NivelActividadDto =
  | 'sedentario'
  | 'ligero'
  | 'moderado'
  | 'activo'
  | 'muy_activo';
export type TipoDietaDto =
  | 'omnivora'
  | 'vegetariana'
  | 'vegana'
  | 'mediterranea'
  | 'keto';

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

  @IsIn(['sedentario', 'ligero', 'moderado', 'activo', 'muy_activo'])
  nivel_actividad!: NivelActividadDto;
}

export class PerfilClinicoDto {
  @IsOptional()
  @IsString()
  objetivo?: string;

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
  embarazo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trimestre_embarazo?: 1 | 2 | 3;

  @IsOptional()
  @IsIn(['folicular', 'ovulatoria', 'lutea', 'menstrual', 'none'])
  fase_menstrual?: 'folicular' | 'ovulatoria' | 'lutea' | 'menstrual' | 'none';
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
}

export class SolicitudPlanDietaDto {
  @IsString()
  usuario_id!: string;

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
}
