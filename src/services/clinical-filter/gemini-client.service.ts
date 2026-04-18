import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeminiDietPayload } from './diet-plan-orchestrator.service';

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiCandidateContent {
  parts?: GeminiCandidatePart[];
}

interface GeminiCandidate {
  content?: GeminiCandidateContent;
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
}

export interface RecetaDia {
  id: string;
  nombre_traducido: string;
  calorias: number;
  proteina: number;
  carbohidratos: number;
  grasas: number;
  sodio: number;
}

export interface ComidasDia {
  desayuno: RecetaDia[];
  comida: RecetaDia[];
  cena: RecetaDia[];
}

export interface PlanDiario {
  lunes: ComidasDia;
  martes: ComidasDia;
  miercoles: ComidasDia;
  jueves: ComidasDia;
  viernes: ComidasDia;
}

export interface PlanDietaGenerado {
  plan_diario: PlanDiario;
  resumen_calorico_diario: number;
  recomendaciones_personalizadas: string[];
  advertencias_ingredientes: string[];
}

const DIAS_PLAN = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
] as const;
const COMIDAS_DIA = ['desayuno', 'comida', 'cena'] as const;

export interface Ejercicio {
  nombre: string;
  series: number;
  repeticiones: string; // "12" o "al fallo" o "5 minutos"
  descanso_segundos: number;
  notas_tecnicas?: string;
}

export interface RutinaSemanal {
  lunes: Ejercicio[];
  martes: Ejercicio[];
  miercoles: Ejercicio[];
  jueves: Ejercicio[];
  viernes: Ejercicio[];
  sabado: Ejercicio[];
  domingo: Ejercicio[];
}

export interface PlanEjercicioGenerado {
  rutina_semanal: Record<string, unknown>;
  resumen_volumen_semanal: string;
  recomendaciones_personalizadas: string[];
}

@Injectable()
export class GeminiClientService {
  constructor(private readonly configService: ConfigService) {}

  async generarPlan(payload: GeminiDietPayload): Promise<PlanDietaGenerado> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Falta GEMINI_API_KEY en variables de entorno',
      );
    }

    const body = {
      systemInstruction: {
        parts: [{ text: payload.gemini_request.system_instruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'CONTEXTO_JSON:\n' +
                payload.gemini_request.contexto_string +
                '\n\nTAREA:\n' +
                payload.gemini_request.prompt_usuario,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${payload.gemini_request.model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new InternalServerErrorException({
        message: 'Error llamando a Gemini',
        status: response.status,
        details: data,
      });
    }

    const parsed = data as GeminiGenerateContentResponse;
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new InternalServerErrorException(
        'Gemini no devolvio texto en candidates[0].content.parts[0].text',
      );
    }

    let planDieta: PlanDietaGenerado;
    try {
      planDieta = JSON.parse(text) as PlanDietaGenerado;
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Error parseando respuesta JSON de Gemini',
        rawText: text,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Validar estructura basica
    if (
      !planDieta.plan_diario ||
      !planDieta.recomendaciones_personalizadas ||
      !planDieta.advertencias_ingredientes
    ) {
      throw new InternalServerErrorException({
        message:
          'Respuesta de Gemini incompleta: falta plan_diario, recomendaciones_personalizadas o advertencias_ingredientes',
        received: planDieta,
      });
    }

    return this.normalizarPlanDieta(planDieta);
  }

  private normalizarPlanDieta(plan: PlanDietaGenerado): PlanDietaGenerado {
    const planDiario = (plan.plan_diario ?? {}) as Partial<PlanDiario>;
    const planDiarioNormalizado = {} as PlanDiario;

    for (const dia of DIAS_PLAN) {
      const comidasDia =
        (planDiario[dia] as Partial<ComidasDia> | undefined) ?? {};
      const comidasNormalizadas = {} as ComidasDia;

      for (const comida of COMIDAS_DIA) {
        const recetas = (comidasDia[comida] ?? []) as unknown[];
        comidasNormalizadas[comida] = recetas
          .filter((receta) => receta && typeof receta === 'object')
          .flatMap((receta) => {
            const recetaNormalizada = this.normalizarReceta(
              receta as Partial<RecetaDia>,
            );

            return recetaNormalizada ? [recetaNormalizada] : [];
          });
      }

      planDiarioNormalizado[dia] = comidasNormalizadas;
    }

    return {
      plan_diario: planDiarioNormalizado,
      resumen_calorico_diario: this.toNumber(plan.resumen_calorico_diario),
      recomendaciones_personalizadas: Array.isArray(
        plan.recomendaciones_personalizadas,
      )
        ? plan.recomendaciones_personalizadas.filter(
            (item) => typeof item === 'string',
          )
        : [],
      advertencias_ingredientes: Array.isArray(plan.advertencias_ingredientes)
        ? plan.advertencias_ingredientes.filter(
            (item) => typeof item === 'string',
          )
        : [],
    };
  }

  private normalizarReceta(receta: Partial<RecetaDia>): RecetaDia | null {
    const idNormalizado = receta.id ? String(receta.id).trim() : '';
    if (!idNormalizado) {
      return null;
    }

    return {
      id: idNormalizado,
      nombre_traducido: receta.nombre_traducido
        ? String(receta.nombre_traducido)
        : 'Receta sin nombre',
      calorias: this.toNumber(receta.calorias),
      proteina: this.toNumber(receta.proteina),
      carbohidratos: this.toNumber(receta.carbohidratos),
      grasas: this.toNumber(receta.grasas),
      sodio: this.toNumber(receta.sodio),
    };
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }
}
