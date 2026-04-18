import { Injectable } from '@nestjs/common';
import {
  FiltroClinicoService,
  PerfilClinicoCalculable,
  RestriccionesClinicasResult,
} from './clinical-filter.service';
import {
  NutricionalCalculoExtendido,
  NutricionalCalculatorService,
  PerfilFisicoCalculable,
} from '../nutricional-calculator/nutricional-calculator.service';
import {
  RecetaEpicurious,
  RecetasRepositoryService,
} from '../repository-recipes/repository-recipes.service';
import {
  PreferenciasDietaDto,
  PerfilClinicoDto,
  PerfilFisicoDto,
  SolicitudPlanDietaDto,
} from './dto/diet-plan-request.dto';

export interface MacronutrientesDiariosEstimados {
  proteina_g: number;
  carbohidratos_g: number;
  grasas_g: number;
}

export interface ParametrosDietaPayload {
  comidas_solicitadas: number;
  objetivo_calorico_diario: number;
  macros_diarios_estimados: MacronutrientesDiariosEstimados;
}

export interface ReglasClinicasInquebrantablesPayload {
  ingredientes_prohibidos: string[];
  limites_nutricionales_diarios: Record<string, number>;
  contexto_medico: string;
}

export type CatalogoRecetaPermitidaPayload = RecetaEpicurious;

export interface GeminiDietPayload {
  parametros_dieta: ParametrosDietaPayload;
  reglas_clinicas_inquebrantables: ReglasClinicasInquebrantablesPayload;
  catalogo_recetas_permitidas: CatalogoRecetaPermitidaPayload[];
  gemini_request: GeminiRequestPayload;
}

export interface GeminiRequestPayload {
  model: string;
  system_instruction: string;
  contexto_string: string;
  prompt_usuario: string;
}

@Injectable()
export class DietPlanOrchestratorService {
  constructor(
    private readonly filtroClinicoService: FiltroClinicoService,
    private readonly nutricionalCalculatorService: NutricionalCalculatorService,
    private readonly recetasRepositoryService: RecetasRepositoryService,
  ) {}

  construirPayloadGemini(solicitud: SolicitudPlanDietaDto): GeminiDietPayload {
    const perfilClinico = solicitud.perfil_clinico ?? null;
    const restriccionesClinicas =
      this.filtroClinicoService.compilarRestriccionesPaciente(
        this.mapPerfilClinico(perfilClinico),
      );
    const calculosNutricionales =
      this.nutricionalCalculatorService.calculateFromProfile(
        this.mapPerfilFisico(solicitud.perfil_fisico),
        this.mapPerfilClinicoCalculo(perfilClinico),
      );

    const ingredientesProhibidos = Array.from(
      new Set([
        ...restriccionesClinicas.ingredientes_prohibidos,
        ...(solicitud.preferencias_dieta.excluir_ingredientes_gusto ?? []),
      ]),
    );

    const etiquetasRequeridas = this.resolverEtiquetasPorDieta(
      solicitud.preferencias_dieta.tipo_dieta,
    );

    const objetivoCaloricoDiario = Math.round(
      calculosNutricionales.caloriasSugeridas,
    );
    const caloriasPorComida = Math.round(
      objetivoCaloricoDiario / solicitud.preferencias_dieta.comidas_por_dia,
    );

    const opcionesBase = this.recetasRepositoryService.buscarRecetasSeguras({
      kcal_objetivo: caloriasPorComida,
      margen: 150,
      ingredientes_prohibidos: ingredientesProhibidos,
      etiquetas_requeridas:
        etiquetasRequeridas.length > 0 ? etiquetasRequeridas : undefined,
      maxResultados: 15,
    });

    const catalogoRecetasPermitidas: CatalogoRecetaPermitidaPayload[] =
      opcionesBase;

    const payloadBase = {
      parametros_dieta: {
        comidas_solicitadas: solicitud.preferencias_dieta.comidas_por_dia,
        objetivo_calorico_diario: objetivoCaloricoDiario,
        macros_diarios_estimados: this.calcularMacrosDiariosEstimados(
          objetivoCaloricoDiario,
        ),
      },
      reglas_clinicas_inquebrantables: {
        ingredientes_prohibidos: ingredientesProhibidos,
        limites_nutricionales_diarios: restriccionesClinicas.limites_nutrientes,
        contexto_medico: this.construirContextoMedico(
          solicitud,
          restriccionesClinicas,
          calculosNutricionales,
        ),
      },
      catalogo_recetas_permitidas: catalogoRecetasPermitidas,
    };

    return {
      ...payloadBase,
      gemini_request: {
        model: 'gemini-1.5-flash',
        system_instruction: this.construirInstruccionSistemaGemini(),
        contexto_string: JSON.stringify(payloadBase),
        prompt_usuario:
          'Genera la dieta utilizando exclusivamente la informacion del contexto. Devuelve la respuesta en JSON estricto, traduce los nombres de las recetas al español y conserva los IDs originales de las recetas seleccionadas.',
      },
    };
  }

  private mapPerfilFisico(
    perfilFisico: PerfilFisicoDto,
  ): PerfilFisicoCalculable {
    return {
      edad: perfilFisico.edad,
      peso_kg: perfilFisico.peso_kg,
      altura_cm: perfilFisico.altura_cm,
      sexo_biologico: perfilFisico.sexo_biologico,
      nivel_actividad: perfilFisico.nivel_actividad,
    };
  }

  private mapPerfilClinico(
    perfilClinico: PerfilClinicoDto | null,
  ): PerfilClinicoCalculable | null {
    if (!perfilClinico) {
      return null;
    }

    return {
      objetivo: perfilClinico.objetivo,
      enfermedades_cronicas: perfilClinico.enfermedades_cronicas,
      alergias: perfilClinico.alergias,
      medicamentos: perfilClinico.medicamentos,
      embarazo: perfilClinico.embarazo,
      trimestre_embarazo: perfilClinico.trimestre_embarazo,
      fase_menstrual: perfilClinico.fase_menstrual,
    };
  }

  private mapPerfilClinicoCalculo(
    perfilClinico: PerfilClinicoDto | null,
  ): PerfilClinicoCalculable | null {
    return this.mapPerfilClinico(perfilClinico);
  }

  private resolverEtiquetasPorDieta(
    tipoDieta: PreferenciasDietaDto['tipo_dieta'],
  ): string[] {
    switch (tipoDieta) {
      case 'vegetariana':
        return ['vegetarian'];
      case 'vegana':
        return ['vegan'];
      case 'mediterranea':
        return ['mediterranean'];
      case 'keto':
        return ['keto'];
      default:
        return [];
    }
  }

  private construirContextoMedico(
    solicitud: SolicitudPlanDietaDto,
    restricciones: RestriccionesClinicasResult,
    calculos: NutricionalCalculoExtendido,
  ): string {
    const perfilClinico = solicitud.perfil_clinico;
    const faseMenstrual = perfilClinico?.fase_menstrual
      ? ` Fase menstrual: ${perfilClinico.fase_menstrual}.`
      : '';
    const embarazo = perfilClinico?.embarazo
      ? ` Embarazo activo${perfilClinico.trimestre_embarazo ? `, trimestre ${perfilClinico.trimestre_embarazo}` : ''}.`
      : '';

    return [
      `Paciente ${solicitud.perfil_fisico.sexo_biologico} de ${solicitud.perfil_fisico.edad} anios.`,
      `TMB base aproximada ${Math.round(calculos.tmbBase)} kcal y gasto total estimado ${Math.round(calculos.gastoEnergeticoTotal)} kcal.`,
      embarazo,
      faseMenstrual,
      restricciones.resumen_clinico,
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calcularMacrosDiariosEstimados(
    objetivoCaloricoDiario: number,
  ): MacronutrientesDiariosEstimados {
    const proteinaKcal = objetivoCaloricoDiario * 0.3;
    const carbohidratosKcal = objetivoCaloricoDiario * 0.4;
    const grasasKcal = objetivoCaloricoDiario * 0.3;

    return {
      proteina_g: Math.round(proteinaKcal / 4),
      carbohidratos_g: Math.round(carbohidratosKcal / 4),
      grasas_g: Math.round(grasasKcal / 9),
    };
  }

  private construirInstruccionSistemaGemini(): string {
    return [
      'Eres un algoritmo clinico de nutricion.',
      'Tu tarea es armar un menu seleccionando unicamente recetas del arreglo catalogo_recetas_permitidas.',
      'NO INVENTES RECETAS: solo puedes usar las que vienen en el catalogo.',
      'SEGURIDAD: ninguna receta seleccionada puede contener los ingredientes_prohibidos.',
      'MATEMATICAS: la suma de los macros de las recetas seleccionadas debe acercarse lo mas posible al objetivo_calorico_diario.',
      'TRADUCCION: responde con las recetas y descripciones traducidas al espanol, sin alterar los IDs ni los valores numericos.',
      'FORMATO: devuelve la respuesta estrictamente en JSON, incluyendo un resumen diario y el arreglo de comidas con los IDs de las recetas elegidas.',
    ].join(' ');
  }
}
