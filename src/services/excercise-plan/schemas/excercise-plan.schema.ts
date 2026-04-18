import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SolicitudPlanEjercicioDto } from '../dto/exercise-plan-request.dto';
import type { PlanEjercicioGenerado } from '../dto/exercise-plan-request.dto';

export type PlanEjercicioDocument = PlanEjercicio & Document;

@Schema({ 
  timestamps: true,
  collection: 'exercise_plans' 
})
export class PlanEjercicio {
  @Prop({ required: true, index: true })
  usuario_id: string;

  @Prop({ type: Object, required: true })
  parametros_iniciales: SolicitudPlanEjercicioDto;

  @Prop({ type: Object, required: true })
  plan_generado: PlanEjercicioGenerado;

  @Prop({ type: String, default: 'gemini-2.5-flash' })
  modelo_ia: string;

  @Prop({ type: Number, default: 1 })
  version: number;
}

export const PlanEjercicioSchema = SchemaFactory.createForClass(PlanEjercicio);

// Índices para consultas rápidas del historial de un usuario
PlanEjercicioSchema.index({ usuario_id: 1, createdAt: -1 });