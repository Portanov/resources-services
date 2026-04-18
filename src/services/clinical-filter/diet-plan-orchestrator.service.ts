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
import { GeminiClientService } from './gemini-client.service';
import type { PlanDietaGenerado } from './gemini-client.service';
import { PlansService } from '../plans/plans.service';

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
    private readonly geminiClientService: GeminiClientService,
    private readonly plansService: PlansService,
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
      calculosNutricionales.caloriasFinalAjustadas,
    );
    const caloriasPorComida = Math.round(
      objetivoCaloricoDiario / solicitud.preferencias_dieta.comidas_por_dia,
    );

    const opcionesBase = this.recetasRepositoryService.buscarRecetasSeguras({
      kcal_objetivo: caloriasPorComida,
      margen: 180,
      ingredientes_prohibidos: ingredientesProhibidos,
      etiquetas_requeridas:
        etiquetasRequeridas.length > 0 ? etiquetasRequeridas : undefined,
      maxResultados: 25,
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
        model: 'gemini-2.5-flash',
        system_instruction: this.construirInstruccionSistemaGemini(),
        contexto_string: JSON.stringify(payloadBase),
        prompt_usuario:
          'Genera un plan de dieta para 5 dias (lunes a viernes) con 3 comidas cada dia. Devuelve JSON estricto con: (1) plan_diario con estructura por dia y comida, (2) resumen_calorico_diario, (3) recomendaciones_personalizadas sobre la dieta, (4) advertencias_ingredientes con los productos a evitar y por que. Usa unicamente recetas del catalogo, traduce nombres al espanol y conserva IDs originales.',
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
    const objetivo = perfilClinico?.objetivo
      ? ` OBJETIVO: ${this.formatearObjetivo(perfilClinico.objetivo)}.`
      : '';

    return [
      `Paciente ${solicitud.perfil_fisico.sexo_biologico} de ${solicitud.perfil_fisico.edad} anios.`,
      `TMB base aproximada ${Math.round(calculos.tmbBase)} kcal y gasto total estimado ${Math.round(calculos.gastoEnergeticoTotal)} kcal.`,
      `OBJETIVO CALÓRICO FINAL: ${Math.round(calculos.caloriasFinalAjustadas)} kcal/día (ajuste por objetivo: ${calculos.ajusteObjetivo > 0 ? '+' : ''}${Math.round(calculos.ajusteObjetivo)} kcal).`,
      objetivo,
      embarazo,
      faseMenstrual,
      restricciones.resumen_clinico,
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatearObjetivo(objetivo: string): string {
    switch (objetivo) {
      case 'bajar_peso':
        return 'Bajar de peso (déficit calórico de 500 kcal/día)';
      case 'subir_peso':
        return 'Subir de peso / volumen muscular (superávit calórico de 300 kcal/día)';
      case 'mantener':
        return 'Mantener peso actual (sin variación calórica)';
      default:
        return objetivo;
    }
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
      'Eres un algoritmo clinico de nutricion especializado en diseño personalizado de dietas.',
      'Tu tarea es armar un plan de comidas para 5 dias (lunes a viernes) seleccionando unicamente recetas del arreglo catalogo_recetas_permitidas.',
      'ESTRUCTURA REQUERIDA: cada dia debe tener exactamente 3 comidas (desayuno, comida, cena).',
      'NO INVENTES RECETAS: solo puedes usar las que vienen en el catalogo. Solo selecciona recetas con IDs presentes en el catalogo.',
      'SEGURIDAD: ninguna receta seleccionada puede contener los ingredientes_prohibidos. Valida cada ingrediente antes de incluir.',
      'MACROS: la suma de los macros de las recetas diarias debe acercarse lo mas posible al objetivo_calorico_diario. Este objetivo ya incluye ajustes por el objetivo del paciente (bajar, subir o mantener peso).',
      'OBJETIVO CALORICO: respeta siempre el objetivo_calorico_diario proporcionado. Si es menor a lo normal, el paciente intenta bajar de peso. Si es mayor, intenta subir. Si es aproximado al gasto normal, intenta mantener.',
      'RECOMENDACIONES: incluye un array de recomendaciones personalizadas basadas en ingredientes_prohibidos, limites_nutricionales_diarios y el OBJETIVO del paciente. Para bajar peso: recomendaciones sobre deficit calórico. Para subir: sobre proteína e hidratos. Para mantener: sobre equilibrio nutricional.',
      'TRADUCCION: responde con los nombres de recetas traducidos al espanol, sin alterar los IDs ni valores numericos.',
      'FORMATO RESPUESTA: JSON con estructura: {plan_diario: {lunes,martes,miercoles,jueves,viernes: {desayuno,comida,cena: [{id,nombre_traducido,calorias,proteina,carbohidratos,grasas,sodio}]}}, resumen_calorico_diario: number, recomendaciones_personalizadas: [string], advertencias_ingredientes: [string]}.',
    ].join(' ');
  }

  async construirYGenerarConGemini(solicitud: SolicitudPlanDietaDto): Promise<{
    payload_enviado_a_gemini: GeminiRequestPayload;
    plan_generado: PlanDietaGenerado;
  }> {
    const payload = this.construirPayloadGemini(solicitud);
    const planGenerado = await this.geminiClientService.generarPlan(payload);

    await this.plansService.saveDiet({
      usuario_id: solicitud.usuario_id,
      ...planGenerado,
    });

    return {
      payload_enviado_a_gemini: payload.gemini_request,
      plan_generado: planGenerado,
    };
  }
}
