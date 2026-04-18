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

    return planDieta;
  }
}
