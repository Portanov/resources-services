import { Injectable } from '@nestjs/common';
import {
  FiltroClinicoService,
  PerfilClinicoCalculable,
  RestriccionesClinicasResult,
} from './clinical-filter.service';
import {
  EstiloVidaCalculable,
  NivelActividad,
  NutricionalCalculoExtendido,
  NutricionalCalculatorService,
  PerfilFisicoCalculable,
} from '../nutricional-calculator/nutricional-calculator.service';
import {
  RecetaEpicurious,
  RecetasRepositoryService,
} from '../repository-recipes/repository-recipes.service';
import {
  EstiloVidaDto,
  PreferenciasDietaDto,
  PerfilClinicoDto,
  PerfilFisicoDto,
  SolicitudPlanDietaDto,
} from './dto/diet-plan-request.dto';
import { GeminiClientService } from './gemini-client.service';
import type { PlanDietaGenerado } from './gemini-client.service';
import { PlansService } from '../plans/plans.service';
import { ClinicProfileService } from '../auth/clinic-profile.service';
import type { CreateClinicProfileDto } from '../auth/dto/clinic-profile.dto';

export interface MacronutrientesDiariosEstimados {
  proteina_g: number;
  carbohidratos_g: number;
  grasas_g: number;
}

export interface ParametrosDietaPayload {
  comidas_solicitadas: number;
  objetivo_calorico_diario: number;
  nivel_actividad_resuelto: NivelActividad;
  macros_diarios_estimados: MacronutrientesDiariosEstimados;
  enfoque_micronutrientes: string[];
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
    private readonly clinicProfileService: ClinicProfileService,
  ) {}

  async sincronizarPerfilClinicoDesdeDieta(
    solicitud: SolicitudPlanDietaDto,
  ): Promise<void> {
    await this.clinicProfileService.upsertClinicProfile(
      this.mapDietaToClinicProfileDto(solicitud, solicitud.usuario_id),
    );
  }

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
        this.mapEstiloVidaCalculo(solicitud.estilo_vida),
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

    const opcionesFallback =
      opcionesBase.length > 0
        ? opcionesBase
        : this.recetasRepositoryService.buscarRecetasSeguras({
            kcal_objetivo: caloriasPorComida,
            margen: 350,
            ingredientes_prohibidos: ingredientesProhibidos,
            etiquetas_requeridas:
              etiquetasRequeridas.length > 0 ? etiquetasRequeridas : undefined,
            maxResultados: 25,
          });

    const opcionesSinEtiqueta =
      opcionesFallback.length > 0
        ? opcionesFallback
        : this.recetasRepositoryService.buscarRecetasSeguras({
            kcal_objetivo: caloriasPorComida,
            margen: 450,
            ingredientes_prohibidos: ingredientesProhibidos,
            maxResultados: 25,
          });

    const catalogoRecetasPermitidas: CatalogoRecetaPermitidaPayload[] =
      opcionesSinEtiqueta;

    const payloadBase = {
      parametros_dieta: {
        comidas_solicitadas: solicitud.preferencias_dieta.comidas_por_dia,
        objetivo_calorico_diario: objetivoCaloricoDiario,
        nivel_actividad_resuelto: calculosNutricionales.nivelActividadResuelto,
        macros_diarios_estimados: this.calcularMacrosDiariosEstimados(
          objetivoCaloricoDiario,
        ),
        enfoque_micronutrientes: calculosNutricionales.objetivosMicronutrientes,
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
      fuma: perfilClinico.fuma,
      consume_alcohol: perfilClinico.consume_alcohol,
      embarazo: perfilClinico.embarazo,
      trimestre_embarazo: perfilClinico.trimestre_embarazo,
      fase_menstrual: perfilClinico.fase_menstrual,
    };
  }

  private mapPerfilClinicoCalculo(
    perfilClinico: PerfilClinicoDto | null,
  ): PerfilClinicoCalculable | null {
    if (!perfilClinico) {
      return null;
    }

    return {
      objetivo: perfilClinico.objetivo,
      fuma: perfilClinico.fuma,
      consume_alcohol: perfilClinico.consume_alcohol,
      embarazo: perfilClinico.embarazo,
      trimestre_embarazo: perfilClinico.trimestre_embarazo,
      fase_menstrual: perfilClinico.fase_menstrual,
    };
  }

  private mapEstiloVidaCalculo(
    estiloVida?: EstiloVidaDto,
  ): EstiloVidaCalculable | null {
    if (!estiloVida) {
      return null;
    }

    return {
      frecuencia_ejercicio_semana: estiloVida.frecuencia_ejercicio_semana,
      horas_entrenamiento_diario: estiloVida.horas_entrenamiento_diario,
    };
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
    const consumoTabaco = perfilClinico?.fuma
      ? ' Reporta consumo de tabaco: priorizar alimentos ricos en vitamina C, E, folato y omega-3.'
      : '';
    const consumoAlcohol = perfilClinico?.consume_alcohol
      ? ' Reporta consumo de alcohol: reforzar tiamina (B1), B6, folato, magnesio y zinc.'
      : '';
    const objetivo = perfilClinico?.objetivo
      ? ` OBJETIVO: ${this.formatearObjetivo(perfilClinico.objetivo)}.`
      : '';
    const estiloVida = solicitud.estilo_vida
      ? ` Estilo de vida: entrena ${this.formatearFrecuencia(solicitud.estilo_vida.frecuencia_ejercicio_semana)} por semana durante ${this.formatearDuracion(solicitud.estilo_vida.horas_entrenamiento_diario)} por dia.`
      : '';

    return [
      `Paciente ${solicitud.perfil_fisico.sexo_biologico} de ${solicitud.perfil_fisico.edad} anios.`,
      `Nivel de actividad resuelto automaticamente: ${calculos.nivelActividadResuelto}.`,
      `TMB base aproximada ${Math.round(calculos.tmbBase)} kcal y gasto total estimado ${Math.round(calculos.gastoEnergeticoTotal)} kcal.`,
      `OBJETIVO CALÓRICO FINAL: ${Math.round(calculos.caloriasFinalAjustadas)} kcal/día (ajuste por objetivo: ${calculos.ajusteObjetivo > 0 ? '+' : ''}${Math.round(calculos.ajusteObjetivo)} kcal).`,
      `Ajuste por consumos: ${calculos.ajusteConsumos > 0 ? '+' : ''}${Math.round(calculos.ajusteConsumos)} kcal.`,
      calculos.objetivosMicronutrientes.length > 0
        ? `Micronutrientes prioritarios: ${calculos.objetivosMicronutrientes.join(', ')}.`
        : '',
      objetivo,
      estiloVida,
      consumoTabaco,
      consumoAlcohol,
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

  private formatearFrecuencia(frecuencia: string): string {
    switch (frecuencia) {
      case '1_2':
        return '1-2 veces';
      case '3_4':
        return '3-4 veces';
      case '5_plus':
        return '5 o más veces';
      default:
        return frecuencia;
    }
  }

  private formatearDuracion(duracion: string): string {
    switch (duracion) {
      case '30min':
        return '30 minutos';
      case '1hr':
        return '1 hora';
      case '2hrs':
        return '2 horas';
      case 'flexible':
        return 'duracion flexible';
      default:
        return duracion;
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
      'ESTILO DE VIDA: considera nivel_actividad_resuelto, frecuencia_ejercicio_semana y horas_entrenamiento_diario para seleccionar comidas acordes al gasto energetico.',
      'OTROS CONSUMOS: si el contexto indica tabaco o alcohol, prioriza recetas con alta densidad nutricional y micronutrientes para compensar posibles deficiencias vitaminicas/minerales.',
      'MICRONUTRIENTES: usa enfoque_micronutrientes para reforzar recomendaciones (ejemplo: vitamina C/E, folato, B1, B6, magnesio, zinc).',
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

  private mapDietaToClinicProfileDto(
    solicitud: SolicitudPlanDietaDto,
    userId: string,
  ): CreateClinicProfileDto {
    const perfilClinico = solicitud.perfil_clinico;
    const estiloVida = solicitud.estilo_vida;

    return {
      userId,
      pesoKg: solicitud.perfil_fisico.peso_kg,
      alturaCm: solicitud.perfil_fisico.altura_cm,
      edad: solicitud.perfil_fisico.edad,
      sexo: this.mapSexoBiologico(solicitud.perfil_fisico.sexo_biologico),
      nivelActividad: this.mapNivelActividadDesdeEstiloVida(estiloVida),
      objetivo: this.mapObjetivoClinico(perfilClinico?.objetivo),
      condicionFemenina: {
        embarazo: perfilClinico?.embarazo ?? null,
        trimestre_embarazo: perfilClinico?.trimestre_embarazo ?? null,
        fase_menstrual: perfilClinico?.fase_menstrual ?? null,
      },
      enfermedades: perfilClinico?.enfermedades_cronicas,
      alergias: perfilClinico?.alergias,
      medicamentos: perfilClinico?.medicamentos,
      preferenciasLogistica: {
        dieta: {
          tipo_dieta: solicitud.preferencias_dieta.tipo_dieta,
          comidas_por_dia: solicitud.preferencias_dieta.comidas_por_dia,
          excluir_ingredientes_gusto:
            solicitud.preferencias_dieta.excluir_ingredientes_gusto ?? [],
          meta_nutricional:
            solicitud.preferencias_dieta.meta_nutricional ?? null,
          control_calorias:
            solicitud.preferencias_dieta.control_calorias ?? null,
          preparacion_comida:
            solicitud.preferencias_dieta.preparacion_comida ?? null,
        },
        estilo_vida: estiloVida ?? null,
      },
    };
  }

  private mapSexoBiologico(sexo: PerfilFisicoDto['sexo_biologico']) {
    return sexo === 'femenino' ? 'female' : 'male';
  }

  private mapObjetivoClinico(objetivo?: PerfilClinicoDto['objetivo']) {
    if (!objetivo) {
      return undefined;
    }

    switch (objetivo) {
      case 'bajar_peso':
        return 'perdida_grasa';
      case 'subir_peso':
        return 'ganancia_muscular';
      case 'mantener':
        return 'mantenimiento';
      default:
        return undefined;
    }
  }

  private mapNivelActividadDesdeEstiloVida(estiloVida?: EstiloVidaDto) {
    if (!estiloVida) {
      return undefined;
    }

    switch (estiloVida.frecuencia_ejercicio_semana) {
      case '1_2':
        return 'ligeramente_activo' as const;
      case '3_4':
        return 'moderado' as const;
      case '5_plus':
        return 'activo' as const;
      default:
        return undefined;
    }
  }
}
