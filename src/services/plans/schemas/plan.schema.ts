import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DietPlanDocument = HydratedDocument<DietPlan>;

@Schema({ _id: false })
export class RecipePortion {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  nombre_traducido!: string;

  @Prop({ required: true })
  calorias!: number;

  @Prop({ required: true })
  proteina!: number;

  @Prop({ required: true })
  carbohidratos!: number;

  @Prop({ required: true })
  grasas!: number;

  @Prop({ required: true })
  sodio!: number;
}

@Schema({ _id: false })
export class MealDay {
  @Prop({ type: [RecipePortion], default: [] })
  desayuno!: RecipePortion[];

  @Prop({ type: [RecipePortion], default: [] })
  comida!: RecipePortion[];

  @Prop({ type: [RecipePortion], default: [] })
  cena!: RecipePortion[];
}

@Schema({ _id: false })
export class WeeklyDietPlan {
  @Prop({ type: MealDay, required: true })
  lunes!: MealDay;

  @Prop({ type: MealDay, required: true })
  martes!: MealDay;

  @Prop({ type: MealDay, required: true })
  miercoles!: MealDay;

  @Prop({ type: MealDay, required: true })
  jueves!: MealDay;

  @Prop({ type: MealDay, required: true })
  viernes!: MealDay;
}

@Schema({ timestamps: true, collection: 'diet_plans' })
export class DietPlan {
  @Prop({ required: true, index: true })
  usuario_id!: number;

  @Prop({ type: WeeklyDietPlan, required: true })
  plan_diario!: WeeklyDietPlan;

  @Prop({ required: true })
  resumen_calorico_diario!: number;

  @Prop({ type: [String], default: [] })
  recomendaciones_personalizadas!: string[];

  @Prop({ type: [String], default: [] })
  advertencias_ingredientes!: string[];
}

export const DietPlanSchema = SchemaFactory.createForClass(DietPlan);
