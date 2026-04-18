import { Injectable, Logger } from '@nestjs/common';

// Idealmente, importas el JSON desde un archivo local al igual que el diccionario clínico
// import * as diccionarioFisico from './data/physical-dictionary.json';

export interface PerfilClinicoEjercicioCalculable {
  padecimientos_lesiones?: string[];
  // En el futuro podrías agregar: cirugias_previas, embarazo, etc.
}

export interface RestriccionesFisicasResult {
  movimientos_prohibidos: string[];
  enfoques_alternativos: string[];
  resumen_medico: string;
}

type ReglaFisica = {
  excluir_movimientos?: string[];
  recomendar_enfoques?: string[];
  explicacion?: string;
};

type DiccionarioFisico = {
  padecimientos: Record<string, ReglaFisica>;
};

// Simulamos el JSON cargado en memoria para el ejemplo
const mockDiccionarioFisico: DiccionarioFisico = {
  padecimientos: {
    lesion_de_rodilla: {
      excluir_movimientos: ['saltos', 'sentadilla pesada', 'alto impacto', 'prensa de piernas profunda'],
      recomendar_enfoques: ['natacion', 'bicicleta estatica', 'isometricos'],
      explicacion: 'Evitar carga axial severa y estrés de impacto en la articulación de la rodilla.',
    },
    hernia_discal: {
      excluir_movimientos: ['peso muerto', 'remo con barra', 'press militar de pie', 'torsiones con carga'],
      recomendar_enfoques: ['planchas', 'fortalecimiento del core', 'maquinas con soporte de espalda'],
      explicacion: 'Riesgo alto en compresión espinal y flexión lumbar bajo carga.',
    },
    hipertension: {
      excluir_movimientos: ['levantamientos maximos (1RM)', 'maniobra de valsalva', 'ejercicios isometricos prolongados'],
      recomendar_enfoques: ['cardio moderado', 'altas repeticiones con poco peso'],
      explicacion: 'Evitar picos severos de presión arterial; requiere control de la respiración constante.',
    },
    hombro_dislocado: {
      excluir_movimientos: ['press tras nuca', 'jalon tras nuca', 'fondos profundos'],
      recomendar_enfoques: ['rotaciones externas con banda', 'elevaciones frontales ligeras'],
      explicacion: 'Evitar posiciones de rotación externa extrema con abducción para prevenir luxaciones.',
    }
  }
};

const MOVIMIENTO_TRADUCCION: Record<string, string> = {
  'saltos': 'jumping',
  'sentadilla pesada': 'heavy squats',
  'alto impacto': 'high impact',
  'peso muerto': 'deadlifts',
  'planchas': 'planks',
  // ... puedes agregar más traducciones aquí si necesitas que Gemini reciba todo en inglés
};

@Injectable()
export class FiltroFisicoService {
  private readonly logger = new Logger(FiltroFisicoService.name);
  
  // Reemplaza esto con tu JSON real importado
  private readonly diccionario = mockDiccionarioFisico;

  compilarRestriccionesFisicas(
    datos?: PerfilClinicoEjercicioCalculable | null,
  ): RestriccionesFisicasResult {
    if (!datos || !datos.padecimientos_lesiones || datos.padecimientos_lesiones.length === 0) {
      return {
        movimientos_prohibidos: [],
        enfoques_alternativos: [],
        resumen_medico: 'Sin padecimientos reportados. Tolerancia al ejercicio estándar.',
      };
    }

    const padecimientos = datos.padecimientos_lesiones;

    // Usamos Sets para evitar duplicados
    const prohibidos = new Set<string>();
    const alternativos = new Set<string>();
    const explicacionesMedicas = new Set<string>();

    padecimientos.forEach((padecimiento) => {
      // Normalizamos la llave para buscar en el diccionario (ej: "Lesión de Rodilla" -> "lesion_de_rodilla")
      const key = padecimiento
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/ /g, '_');

      const reglas = this.diccionario.padecimientos[key];

      if (reglas) {
        if (reglas.excluir_movimientos) {
          reglas.excluir_movimientos.forEach((mov) =>
            prohibidos.add(this.normalizarMovimiento(mov)),
          );
        }
        if (reglas.recomendar_enfoques) {
          reglas.recomendar_enfoques.forEach((enf) =>
            alternativos.add(this.normalizarMovimiento(enf)),
          );
        }
        if (reglas.explicacion) {
          explicacionesMedicas.add(reglas.explicacion);
        }
      } else {
        // Si el padecimiento no está en el diccionario, aplicamos una regla general conservadora
        this.logger.warn(`Padecimiento físico no encontrado en diccionario: ${padecimiento}`);
        prohibidos.add(`movimientos que causen dolor en: ${padecimiento.toLowerCase()}`);
        explicacionesMedicas.add(`Padecimiento no catalogado: ${padecimiento}. Proceder con extrema precaución en el área afectada.`);
      }
    });

    return {
      movimientos_prohibidos: Array.from(prohibidos),
      enfoques_alternativos: Array.from(alternativos),
      resumen_medico: Array.from(explicacionesMedicas).join(' '),
    };
  }

  private normalizarMovimiento(texto: string): string {
    const sinAcentos = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return MOVIMIENTO_TRADUCCION[sinAcentos] ?? sinAcentos;
  }
}