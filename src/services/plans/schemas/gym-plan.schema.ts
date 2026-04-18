import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExercisePlanDocument = HydratedDocument<ExercisePlan>;

@Schema({ _id: false })
export class ExerciseDetail {
  @Prop({ required: true })
  ejercicio!: string;

  @Prop({ required: true })
  series!: number;

  @Prop({ required: true })
  repeticiones!: string;

  @Prop({ required: true })
  descanso_segundos!: number;
}

@Schema({ _id: false })
export class WeeklyRoutine {
  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_1?: ExerciseDetail[];

  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_2?: ExerciseDetail[];

  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_3?: ExerciseDetail[];

  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_4?: ExerciseDetail[];

  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_5?: ExerciseDetail[];

  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_6?: ExerciseDetail[];

  @Prop({ type: [ExerciseDetail], default: undefined })
  dia_7?: ExerciseDetail[];
}

@Schema({ timestamps: true, collection: 'exercise_plans' })
export class ExercisePlan {
  @Prop({ required: true, index: true })
  usuario_id!: string;

  @Prop({ type: WeeklyRoutine, required: true })
  rutina_semanal!: WeeklyRoutine;

  @Prop({ required: true })
  resumen_volumen_semanal!: string;

  @Prop({ type: [String], default: [] })
  recomendaciones_personalizadas!: string[];

  @Prop({ type: String, default: 'gemini-2.5-flash' })
  modelo_ia!: string;

  @Prop({ type: Number, default: 1 })
  version!: number;
}

export const ExercisePlanSchema = SchemaFactory.createForClass(ExercisePlan);

ExercisePlanSchema.index({ usuario_id: 1, createdAt: -1 });