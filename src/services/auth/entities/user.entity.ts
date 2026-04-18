import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClinicProfileEntity } from './clinic-profile.entity';

@Entity({ name: 'users', schema: 'public' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp without time zone',
    default: () => 'now()',
  })
  updatedAt!: Date;

  @OneToOne(() => ClinicProfileEntity)
  clinicProfile?: ClinicProfileEntity;
}
