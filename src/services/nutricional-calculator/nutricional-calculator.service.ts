import { Injectable } from '@nestjs/common';
import { NutricionalCalculationDto } from './dto/nutricional-calculation.dto';
import type { ObjetivoCalculo } from '../clinical-filter/clinical-filter.service';

export type SexoBiologico = 'masculino' | 'femenino';
export type NivelActividad =
  | 'sedentario'
  | 'ligero'
  | 'moderado'
  | 'activo'
  | 'muy_activo';
export type FaseMenstrual =
  | 'folicular'
  | 'ovulatoria'
  | 'lutea'
  | 'menstrual'
  | 'none';
export type FrecuenciaEntrenamiento = '1_2' | '3_4' | '5_plus';
export type HorasEntrenamientoDiario = '30min' | '1hr' | '2hrs' | 'flexible';

export interface PerfilFisicoCalculable {
  edad: number;
  peso_kg: number;
  altura_cm: number;
  sexo_biologico: SexoBiologico;
}

export interface PerfilClinicoCalculable {
  objetivo?: ObjetivoCalculo;
  fuma?: boolean;
  consume_alcohol?: boolean;
  embarazo?: boolean;
  trimestre_embarazo?: 1 | 2 | 3;
  fase_menstrual?: FaseMenstrual;
}

export interface EstiloVidaCalculable {
  frecuencia_ejercicio_semana: FrecuenciaEntrenamiento;
  horas_entrenamiento_diario: HorasEntrenamientoDiario;
}

export interface NutricionalCalculationResult {
  tmbBase: number;
  ajusteFemeninoKcal: number;
  tmbAjustada: number;
  detalles: string[];
}

export interface NutricionalCalculoExtendido extends NutricionalCalculationResult {
  nivelActividadResuelto: NivelActividad;
  factorActividad: number;
  gastoEnergeticoTotal: number;
  caloriasSugeridas: number;
  ajusteConsumos: number;
  ajusteObjetivo: number;
  caloriasFinalAjustadas: number;
  objetivosMicronutrientes: string[];
}

@Injectable()
export class NutricionalCalculatorService {
  calculate(input: NutricionalCalculationDto): NutricionalCalculationResult {
    const tmbBase = this.calculateMifflinStJeor(input);
    const { extraKcal, detalles } =
      this.calculateFemaleConditionAdjustments(input);

    return {
      tmbBase,
      ajusteFemeninoKcal: extraKcal,
      tmbAjustada: tmbBase + extraKcal,
      detalles,
    };
  }

  calculateFromProfile(
    perfilFisico: PerfilFisicoCalculable,
    perfilClinico?: PerfilClinicoCalculable | null,
    estiloVida?: EstiloVidaCalculable | null,
  ): NutricionalCalculoExtendido {
    const tmbBase = this.calculateMifflinStJeorFromProfile(perfilFisico);
    const nivelActividadResuelto =
      this.resolveActivityLevelFromLifestyle(estiloVida);
    const factorActividad = this.resolveActivityFactor(nivelActividadResuelto);
    const gastoEnergeticoTotal = tmbBase * factorActividad;
    const { extraKcal, detalles } =
      this.calculateFemaleConditionAdjustmentsFromProfile(
        perfilFisico.sexo_biologico,
        perfilClinico,
      );
    const { ajusteConsumos, detallesConsumo, objetivosMicronutrientes } =
      this.calculateLifestyleConsumptionAdjustments(perfilClinico);

    const caloriasSugeridas = gastoEnergeticoTotal + extraKcal + ajusteConsumos;
    const ajusteObjetivo = this.applyObjectiveAdjustment(
      perfilClinico?.objetivo,
    );
    const caloriasFinalAjustadas = caloriasSugeridas + ajusteObjetivo;

    return {
      tmbBase,
      ajusteFemeninoKcal: extraKcal,
      tmbAjustada: tmbBase + extraKcal,
      detalles: [...detalles, ...detallesConsumo],
      nivelActividadResuelto,
      factorActividad,
      gastoEnergeticoTotal,
      caloriasSugeridas,
      ajusteConsumos,
      ajusteObjetivo,
      caloriasFinalAjustadas,
      objetivosMicronutrientes,
    };
  }

  private calculateLifestyleConsumptionAdjustments(
    perfilClinico?: PerfilClinicoCalculable | null,
  ): {
    ajusteConsumos: number;
    detallesConsumo: string[];
    objetivosMicronutrientes: string[];
  } {
    if (!perfilClinico) {
      return {
        ajusteConsumos: 0,
        detallesConsumo: [],
        objetivosMicronutrientes: [],
      };
    }

    let ajusteConsumos = 0;
    const detallesConsumo: string[] = [];
    const micronutrientes = new Set<string>();

    if (perfilClinico.fuma) {
      ajusteConsumos += 80;
      detallesConsumo.push(
        'Fumador activo: +80 kcal para soporte nutricional.',
      );
      micronutrientes.add('vitamina C');
      micronutrientes.add('vitamina E');
      micronutrientes.add('folato');
      micronutrientes.add('omega-3');
    }

    if (perfilClinico.consume_alcohol) {
      ajusteConsumos += 120;
      detallesConsumo.push(
        'Consumo de alcohol: +120 kcal para compensar densidad nutricional.',
      );
      micronutrientes.add('vitamina B1 (tiamina)');
      micronutrientes.add('vitamina B6');
      micronutrientes.add('folato');
      micronutrientes.add('magnesio');
      micronutrientes.add('zinc');
    }

    return {
      ajusteConsumos,
      detallesConsumo,
      objetivosMicronutrientes: Array.from(micronutrientes),
    };
  }

  private resolveActivityLevelFromLifestyle(
    estiloVida?: EstiloVidaCalculable | null,
  ): NivelActividad {
    if (!estiloVida) {
      return 'sedentario';
    }

    const { frecuencia_ejercicio_semana, horas_entrenamiento_diario } =
      estiloVida;

    if (frecuencia_ejercicio_semana === '5_plus') {
      return horas_entrenamiento_diario === '30min' ? 'activo' : 'muy_activo';
    }

    if (frecuencia_ejercicio_semana === '3_4') {
      if (horas_entrenamiento_diario === '2hrs') {
        return 'muy_activo';
      }
      if (horas_entrenamiento_diario === '1hr') {
        return 'activo';
      }
      return 'moderado';
    }

    if (horas_entrenamiento_diario === '2hrs') {
      return 'activo';
    }

    return horas_entrenamiento_diario === '30min' ? 'ligero' : 'moderado';
  }

  private calculateMifflinStJeor(input: NutricionalCalculationDto): number {
    const sexoOffset = input.sexo === 'male' ? 5 : -161;

    return (
      10 * input.pesoKg + 6.25 * input.alturaCm - 5 * input.edad + sexoOffset
    );
  }

  private calculateMifflinStJeorFromProfile(
    perfilFisico: PerfilFisicoCalculable,
  ): number {
    const sexoOffset = perfilFisico.sexo_biologico === 'masculino' ? 5 : -161;

    return (
      10 * perfilFisico.peso_kg +
      6.25 * perfilFisico.altura_cm -
      5 * perfilFisico.edad +
      sexoOffset
    );
  }

  private calculateFemaleConditionAdjustments(
    input: NutricionalCalculationDto,
  ): {
    extraKcal: number;
    detalles: string[];
  } {
    let extraKcal = 0;
    const detalles: string[] = [];

    if (input.sexo !== 'female') {
      return { extraKcal, detalles };
    }

    if (input.faseMenstrual === 'lutea') {
      const ajuste = this.normalizeLutealPhaseAdjustment(
        input.ajusteFaseLuteaKcal,
      );
      extraKcal += ajuste;
      detalles.push(`Fase lutea: +${ajuste} kcal`);
    }

    if (input.embarazo && input.trimestreEmbarazo === 2) {
      extraKcal += 340;
      detalles.push('Embarazo segundo trimestre: +340 kcal');
    }

    return { extraKcal, detalles };
  }

  private calculateFemaleConditionAdjustmentsFromProfile(
    sexoBiologico: SexoBiologico,
    perfilClinico?: PerfilClinicoCalculable | null,
  ): {
    extraKcal: number;
    detalles: string[];
  } {
    let extraKcal = 0;
    const detalles: string[] = [];

    if (sexoBiologico !== 'femenino' || !perfilClinico) {
      return { extraKcal, detalles };
    }

    if (perfilClinico.fase_menstrual === 'lutea') {
      const ajuste = 200;
      extraKcal += ajuste;
      detalles.push(`Fase lutea: +${ajuste} kcal`);
    }

    if (perfilClinico.embarazo && perfilClinico.trimestre_embarazo === 2) {
      extraKcal += 340;
      detalles.push('Embarazo segundo trimestre: +340 kcal');
    }

    return { extraKcal, detalles };
  }

  private applyObjectiveAdjustment(objetivo?: ObjetivoCalculo): number {
    switch (objetivo) {
      case 'bajar_peso':
        return -500; // Déficit de 500 kcal/día ~500g por semana
      case 'subir_peso':
        return 300; // Superávit de 300 kcal/día ~250-300g por semana
      case 'mantener':
      default:
        return 0;
    }
  }

  private resolveActivityFactor(nivelActividad: NivelActividad): number {
    const factors: Record<NivelActividad, number> = {
      sedentario: 1.2,
      ligero: 1.375,
      moderado: 1.55,
      activo: 1.725,
      muy_activo: 1.9,
    };

    return factors[nivelActividad];
  }

  private normalizeLutealPhaseAdjustment(ajuste?: number): number {
    const defaultAdjustment = 200;

    if (ajuste === undefined || Number.isNaN(ajuste)) {
      return defaultAdjustment;
    }

    return Math.max(100, Math.min(300, ajuste));
  }
}
