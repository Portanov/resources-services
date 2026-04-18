import { Injectable, Logger } from '@nestjs/common';

// Idealmente, importas el JSON desde un archivo local
import * as diccionarioClinico from './data/clinical-dictionary.json';

export type ObjetivoCalculo = 'bajar_peso' | 'subir_peso' | 'mantener';

export interface PerfilClinicoCalculable {
  objetivo?: ObjetivoCalculo;
  enfermedades_cronicas?: string[];
  medicamentos?: string[];
  alergias?: string[];
  fuma?: boolean;
  consume_alcohol?: boolean;
  embarazo?: boolean;
  trimestre_embarazo?: 1 | 2 | 3;
  fase_menstrual?: 'folicular' | 'ovulatoria' | 'lutea' | 'menstrual' | 'none';
}

export interface RestriccionesClinicasResult {
  ingredientes_prohibidos: string[];
  ingredientes_limitados: string[];
  limites_nutrientes: Record<string, number>;
  resumen_clinico: string;
}

type ReglaClinica = {
  excluir_ingredientes?: string[];
  limitar?: string[];
  explicacion?: string;
  limitar_nutriente?: Record<string, number>;
};

type DiccionarioClinico = {
  enfermedad: Record<string, ReglaClinica>;
  interacciones_medicamentos: Record<string, ReglaClinica>;
};

const INGREDIENTE_TRADUCCION: Record<string, string> = {
  cacahuate: 'peanut',
  mariscos: 'shellfish',
  cebolla: 'onion',
  'azucar refinada': 'refined sugar',
  dulces: 'sweets',
  soya: 'soy',
  tofu: 'tofu',
  edamame: 'edamame',
  col: 'cabbage',
  brocoli: 'broccoli',
  coliflor: 'cauliflower',
  embutidos: 'processed meats',
  'salsa de soya': 'soy sauce',
  tocino: 'bacon',
  ajo: 'garlic',
  frijoles: 'beans',
  lentejas: 'lentils',
  'leche de vaca': 'cow milk',
  manzana: 'apple',
  'sal de mesa': 'table salt',
  enlatados: 'canned foods',
  palta: 'avocado',
  aguacate: 'avocado',
  banana: 'banana',
  naranja: 'orange',
  lacteos: 'dairy',
  nueces: 'nuts',
  'carnes rojas': 'red meat',
  visceras: 'organ meats',
  sardinas: 'sardines',
  anchoas: 'anchovies',
  cerveza: 'beer',
  'arroz blanco': 'white rice',
  'pan blanco': 'white bread',
  papa: 'potato',
  'pasta regular': 'regular pasta',
  jugo: 'juice',
  'jugo de toronja': 'grapefruit juice',
  toronja: 'grapefruit',
  pomelo: 'grapefruit',
};

@Injectable()
export class FiltroClinicoService {
  private readonly logger = new Logger(FiltroClinicoService.name);
  private readonly diccionario =
    diccionarioClinico as unknown as DiccionarioClinico;

  compilarRestriccionesPaciente(
    datos?: PerfilClinicoCalculable | null,
  ): RestriccionesClinicasResult {
    if (!datos) {
      return {
        ingredientes_prohibidos: [],
        ingredientes_limitados: [],
        limites_nutrientes: {},
        resumen_clinico: '',
      };
    }

    const enfermedades = datos.enfermedades_cronicas ?? [];
    const medicamentos = datos.medicamentos ?? [];
    const alergias = datos.alergias ?? [];

    // Usamos Sets para evitar ingredientes duplicados
    const prohibidos = new Set<string>();
    const limitados = new Set<string>();
    const explicacionesMedicas = new Set<string>();
    const limitesNutricionales: Record<string, number> = {};

    // 1. Procesar Alergias (Regla de oro: van directo a prohibidos)
    alergias.forEach((alergia) => {
      prohibidos.add(this.normalizarIngrediente(alergia));
      explicacionesMedicas.add(
        `Exclusión estricta por alergia reportada a: ${alergia}.`,
      );
    });

    // 2. Procesar Enfermedades
    enfermedades.forEach((enfermedad) => {
      // Normalizamos el string para que coincida con las llaves de tu JSON
      const key = enfermedad.toLowerCase().replace(/ /g, '_');
      const reglas = this.diccionario.enfermedad[key];

      if (reglas) {
        if (reglas.excluir_ingredientes) {
          reglas.excluir_ingredientes.forEach((ing) =>
            prohibidos.add(this.normalizarIngrediente(ing)),
          );
        }
        if (reglas.limitar) {
          reglas.limitar.forEach((ing) =>
            limitados.add(this.normalizarIngrediente(ing)),
          );
        }
        if (reglas.explicacion) {
          explicacionesMedicas.add(reglas.explicacion);
        }
        if (reglas.limitar_nutriente) {
          this.fusionarLimitesNutricionales(
            limitesNutricionales,
            reglas.limitar_nutriente,
          );
        }
      } else {
        this.logger.warn(
          `Enfermedad no encontrada en diccionario: ${enfermedad}`,
        );
      }
    });

    // 3. Procesar Interacciones de Medicamentos
    medicamentos.forEach((medicamento) => {
      const key = medicamento.toLowerCase().replace(/ /g, '_');
      const interaccion = this.diccionario.interacciones_medicamentos[key];

      if (interaccion) {
        if (interaccion.limitar) {
          interaccion.limitar.forEach((ing) =>
            limitados.add(this.normalizarIngrediente(ing)),
          );
        }
        if (interaccion.excluir_ingredientes) {
          // Por si en el futuro agregas exclusiones aquí
          interaccion.excluir_ingredientes.forEach((ing) =>
            prohibidos.add(this.normalizarIngrediente(ing)),
          );
        }
        if (interaccion.explicacion) {
          explicacionesMedicas.add(interaccion.explicacion);
        }
      }
    });

    // 4. Limpieza: Si un ingrediente está prohibido, lo quitamos de limitados
    prohibidos.forEach((ing) => limitados.delete(ing));

    if (datos.embarazo && datos.trimestre_embarazo === 2) {
      explicacionesMedicas.add('Embarazo segundo trimestre: +340 kcal.');
    }

    if (datos.fuma) {
      explicacionesMedicas.add(
        'Paciente fumador: reforzar vitamina C, vitamina E, folato y omega-3 en la dieta.',
      );
    }

    if (datos.consume_alcohol) {
      explicacionesMedicas.add(
        'Consumo de alcohol reportado: reforzar tiamina (B1), B6, folato, magnesio y zinc.',
      );
      limitados.add('beer');
      limitados.add('alcohol');
      limitados.add('wine');
    }

    return {
      ingredientes_prohibidos: Array.from(prohibidos),
      ingredientes_limitados: Array.from(limitados),
      limites_nutrientes: limitesNutricionales,
      resumen_clinico: Array.from(explicacionesMedicas).join(' '),
    };
  }

  private normalizarIngrediente(texto: string): string {
    const sinAcentos = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return INGREDIENTE_TRADUCCION[sinAcentos] ?? sinAcentos;
  }

  private fusionarLimitesNutricionales(
    limitesActuales: Record<string, number>,
    nuevosLimites: Record<string, number>,
  ) {
    for (const [nutriente, valorMaximo] of Object.entries(nuevosLimites)) {
      const valorMaximoNumerico = Number(valorMaximo);

      if (!Object.hasOwn(limitesActuales, nutriente)) {
        limitesActuales[nutriente] = valorMaximoNumerico;
      } else {
        limitesActuales[nutriente] = Math.min(
          limitesActuales[nutriente],
          valorMaximoNumerico,
        );
      }
    }
  }
}
