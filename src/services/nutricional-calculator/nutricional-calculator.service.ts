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

export interface PerfilFisicoCalculable {
  edad: number;
  peso_kg: number;
  altura_cm: number;
  sexo_biologico: SexoBiologico;
  nivel_actividad: NivelActividad;
}

export interface PerfilClinicoCalculable {
  objetivo?: ObjetivoCalculo;
  embarazo?: boolean;
  trimestre_embarazo?: 1 | 2 | 3;
  fase_menstrual?: FaseMenstrual;
}

export interface NutricionalCalculationResult {
  tmbBase: number;
  ajusteFemeninoKcal: number;
  tmbAjustada: number;
  detalles: string[];
}

export interface NutricionalCalculoExtendido extends NutricionalCalculationResult {
  factorActividad: number;
  gastoEnergeticoTotal: number;
  caloriasSugeridas: number;
  ajusteObjetivo: number;
  caloriasFinalAjustadas: number;
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
  ): NutricionalCalculoExtendido {
    const tmbBase = this.calculateMifflinStJeorFromProfile(perfilFisico);
    const factorActividad = this.resolveActivityFactor(
      perfilFisico.nivel_actividad,
    );
    const gastoEnergeticoTotal = tmbBase * factorActividad;
    const { extraKcal, detalles } =
      this.calculateFemaleConditionAdjustmentsFromProfile(
        perfilFisico.sexo_biologico,
        perfilClinico,
      );

    const caloriasSugeridas = gastoEnergeticoTotal + extraKcal;
    const ajusteObjetivo = this.applyObjectiveAdjustment(
      perfilClinico?.objetivo,
    );
    const caloriasFinalAjustadas = caloriasSugeridas + ajusteObjetivo;

    return {
      tmbBase,
      ajusteFemeninoKcal: extraKcal,
      tmbAjustada: tmbBase + extraKcal,
      detalles,
      factorActividad,
      gastoEnergeticoTotal,
      caloriasSugeridas,
      ajusteObjetivo,
      caloriasFinalAjustadas,
    };
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
