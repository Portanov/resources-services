import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsString, ValidateNested } from 'class-validator';

export const METAS_PERMITIDAS = ['Tonificación muscular', 'Fuerza y potencia', 'Resistencia cardio', 'Flexibilidad y movilidad'] as const;
export const LUGARES_PERMITIDOS = ['Gimnasio', 'En casa', 'Al aire libre', 'Mixto'] as const;
export const NIVELES_PERMITIDOS = ['Principiante', 'Intermedio', 'Avanzado'] as const;
export const DIAS_PERMITIDOS = ['1-2 días', '3-4 días', '5-6 días', 'Todos los días'] as const;

export type MetaEjercicio = typeof METAS_PERMITIDAS[number];
export type LugarEjercicio = typeof LUGARES_PERMITIDOS[number];
export type NivelActividad = typeof NIVELES_PERMITIDOS[number];
export type FrecuenciaDias = typeof DIAS_PERMITIDOS[number];

export class PerfilActividadInicialDto {
  @Type(() => Boolean)
  @IsBoolean()
  hace_ejercicio!: boolean;

  @IsIn(DIAS_PERMITIDOS)
  dias_por_semana!: FrecuenciaDias;

  @IsIn(NIVELES_PERMITIDOS)
  nivel_actual!: NivelActividad;
}

export class PreferenciasEjercicioInicialDto {
  @IsIn(METAS_PERMITIDAS)
  meta_principal!: MetaEjercicio;

  @IsIn(LUGARES_PERMITIDOS)
  lugar_preferido!: LugarEjercicio;
}

export class SolicitudPlanEjercicioDto {
  @IsString()
  usuario_id!: string;

  @ValidateNested()
  @Type(() => PerfilActividadInicialDto)
  perfil_actividad!: PerfilActividadInicialDto;

  @ValidateNested()
  @Type(() => PreferenciasEjercicioInicialDto)
  preferencias_ejercicio!: PreferenciasEjercicioInicialDto;
}

export interface PlanEjercicioGenerado {
  rutina_semanal: Record<string, any>;
  resumen_volumen_semanal: string;
  recomendaciones_personalizadas: string[];
}