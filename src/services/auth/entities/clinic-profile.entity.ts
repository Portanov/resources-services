import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

export type SexoBiologico = 'male' | 'female';
export type NivelActividad =
  | 'sedentario'
  | 'ligeramente_activo'
  | 'moderado'
  | 'activo'
  | 'muy_activo';
export type ObjetivoClinico =
  | 'perdida_grasa'
  | 'ganancia_muscular'
  | 'mantenimiento'
  | 'rendimiento'
  | 'salud_general'
  | 'rehabilitacion';

@Entity({ name: 'perfiles_clinicos', schema: 'public' })
export class ClinicProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'peso_kg', type: 'numeric', nullable: true })
  pesoKg!: string | null;

  @Column({ name: 'altura_cm', type: 'numeric', nullable: true })
  alturaCm!: string | null;

  @Column({ type: 'integer', nullable: true })
  edad!: number | null;

  @Column({ type: 'varchar', nullable: true })
  sexo!: SexoBiologico | null;

  @Column({ name: 'nivel_actividad', type: 'varchar', nullable: true })
  nivelActividad!: NivelActividad | null;

  @Column({
    name: 'condicion_femenina',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  condicionFemenina!: Record<string, unknown>;

  @Column({ name: 'enfermedades', type: 'jsonb', default: () => "'[]'::jsonb" })
  enfermedades!: unknown[];

  @Column({ name: 'alergias', type: 'jsonb', default: () => "'[]'::jsonb" })
  alergias!: unknown[];

  @Column({
    name: 'medicamentos',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  medicamentos!: unknown[];

  @Column({
    name: 'biomarcadores',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  biomarcadores!: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  objetivo!: ObjetivoClinico | null;

  @Column({
    name: 'preferencias_logistica',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  preferenciasLogistica!: Record<string, unknown>;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'now()',
  })
  updatedAt!: Date;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => UserEntity, (user) => user.clinicProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
