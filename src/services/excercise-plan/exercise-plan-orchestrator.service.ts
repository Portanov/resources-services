import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SolicitudPlanEjercicioDto, PlanEjercicioGenerado } from './dto/exercise-plan-request.dto';
import { GeminiClientService } from '../clinical-filter/gemini-client.service'; 
import { PlanEjercicio, PlanEjercicioDocument } from './schemas/excercise-plan.schema';
import { GymPlanService } from '../plans/gym.service';

export interface ParametrosEjercicioSimplificado {
  nivel_experiencia: string;
  frecuencia_semanal: string;
  meta_principal: string;
  entorno_entrenamiento: string;
  hace_ejercicio_actualmente: boolean;
}

export interface GeminiExercisePayload {
  parametros_ejercicio: ParametrosEjercicioSimplificado;
  gemini_request: GeminiRequestPayload;
}

export interface GeminiRequestPayload {
  model: string;
  system_instruction: string;
  contexto_string: string;
  prompt_usuario: string;
}

@Injectable()
export class ExercisePlanOrchestratorService {
  constructor(
    private readonly geminiClientService: GeminiClientService,
    private readonly gymService: GymPlanService, // Inyectamos el servicio de base de datos
    @InjectModel(PlanEjercicio.name) private planEjercicioModel: Model<PlanEjercicioDocument>,
  ) {}

  // Esta función ahora es puramente síncrona y se encarga solo de preparar los datos
  construirPayloadGemini(solicitud: SolicitudPlanEjercicioDto): GeminiExercisePayload {
    const { perfil_actividad, preferencias_ejercicio } = solicitud;

    const payloadBase = {
      parametros_ejercicio: {
        nivel_experiencia: perfil_actividad.nivel_actual,
        frecuencia_semanal: perfil_actividad.dias_por_semana,
        meta_principal: preferencias_ejercicio.meta_principal,
        entorno_entrenamiento: preferencias_ejercicio.lugar_preferido,
        hace_ejercicio_actualmente: perfil_actividad.hace_ejercicio,
      },
    };

    return {
      ...payloadBase,
      gemini_request: {
        model: 'gemini-2.5-flash',
        system_instruction: this.construirInstruccionSistemaGemini(),
        contexto_string: JSON.stringify(payloadBase),
        prompt_usuario: `Genera un plan de entrenamiento estructurado para un usuario nivel ${perfil_actividad.nivel_actual} con objetivo principal de ${preferencias_ejercicio.meta_principal}. Devuelve un JSON estricto con: (1) rutina_semanal dividida por días de la semana (ej. "dia_1", "dia_2") respetando una frecuencia de ${perfil_actividad.dias_por_semana}, adaptando los ejercicios para hacerlos en ${preferencias_ejercicio.lugar_preferido} (incluyendo series, repeticiones y descansos en segundos), (2) resumen_volumen_semanal, y (3) recomendaciones_personalizadas sobre progresión segura. Traduce los ejercicios al español.`,
      },
    };
  }

  private construirInstruccionSistemaGemini(): string {
    return [
      'Eres un entrenador personal de IA especializado en crear planes rápidos de adaptación anatómica y deportiva.',
      'Tu objetivo es diseñar una rutina semanal estrictamente ajustada a los parámetros de frecuencia, entorno y nivel proporcionados.',
      'REGLAS DE ENTORNO: Si el entorno es "En casa" o "Al aire libre", utiliza ejercicios con peso corporal (calistenia) o equipamiento nulo/mínimo. Si es "Gimnasio", integra máquinas, poleas y pesos libres.',
      'REGLAS DE FRECUENCIA: Si el usuario indica "1-2 días", diseña rutinas tipo Full Body. Si es "3-4 días", usa divisiones Torso/Pierna (Upper/Lower) o Empuje/Tracción. Para "5-6 días", utiliza divisiones por grupo muscular específico.',
      'REGLAS DE NIVEL: Para "Principiante", prioriza técnica, máquinas guiadas (si aplica) y menor volumen (menos series). Para niveles superiores, aumenta el volumen e incluye ejercicios compuestos.',
      'FORMATO DE RESPUESTA: Únicamente JSON válido. Estructura esperada: {rutina_semanal: {dia_1: [{ejercicio, series, repeticiones, descanso_segundos}], dia_2: [...]}, resumen_volumen_semanal: string, recomendaciones_personalizadas: [string]}.',
    ].join(' ');
  }

  // Aquí es donde manejamos toda la asincronía (await)
  async construirYGenerarConGemini(solicitud: SolicitudPlanEjercicioDto): Promise<{
    plan_generado: PlanEjercicioGenerado;
    id_guardado: string;
  }> {
    // 1. Construimos el payload (Síncrono)
    const payload = this.construirPayloadGemini(solicitud);
    
    // 2. Generamos el plan con Gemini (Asíncrono)
    const planGenerado = await this.geminiClientService.generarPlanEntrenamiento(payload);

    // 3. Guardamos en MongoDB usando el servicio especializado (Asíncrono)
    const planGuardado = await this.gymService.saveExercisePlan({
      usuario_id: solicitud.usuario_id,
      parametros_iniciales: solicitud,
      rutina_semanal: planGenerado.rutina_semanal,
      resumen_volumen_semanal: planGenerado.resumen_volumen_semanal,
      recomendaciones_personalizadas: planGenerado.recomendaciones_personalizadas,
      modelo_ia: 'gemini-2.5-flash',
      version: 1,
    });

    return {
      plan_generado: planGenerado,
      id_guardado: planGuardado._id.toString(),
    };
  }
}