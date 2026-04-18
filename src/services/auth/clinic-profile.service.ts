import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicProfileEntity } from './entities/clinic-profile.entity';
import { UserEntity } from './entities/user.entity';
import {
  CreateClinicProfileDto,
  DeleteClinicProfileDto,
} from './dto/clinic-profile.dto';

@Injectable()
export class ClinicProfileService {
  constructor(
    @InjectRepository(ClinicProfileEntity)
    private readonly clinicProfileRepository: Repository<ClinicProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async upsertClinicProfile(dto: CreateClinicProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }

    const existingProfile = await this.clinicProfileRepository.findOne({
      where: { userId: dto.userId },
    });

    const preferenciasActuales =
      (existingProfile?.preferenciasLogistica as Record<string, unknown>) ?? {};
    const planEjercicioActual =
      (preferenciasActuales['planEjercicio'] as Record<string, unknown>) ?? {};
    const perfilActividadActual =
      (planEjercicioActual['perfilActividad'] as Record<string, unknown>) ?? {};
    const preferenciasEjercicioActual =
      (planEjercicioActual['preferenciasEjercicio'] as Record<string, unknown>) ??
      {};

    const preferenciasLogistica = {
      ...preferenciasActuales,
      ...(dto.preferenciasLogistica ?? {}),
      planEjercicio: {
        ...planEjercicioActual,
        perfilActividad: {
          ...perfilActividadActual,
          ...(dto.haceEjercicio !== undefined
            ? { hace_ejercicio: dto.haceEjercicio }
            : {}),
          ...(dto.diasPorSemana !== undefined
            ? { dias_por_semana: dto.diasPorSemana }
            : {}),
          ...(dto.nivelActual !== undefined
            ? { nivel_actual: dto.nivelActual }
            : {}),
        },
        preferenciasEjercicio: {
          ...preferenciasEjercicioActual,
          ...(dto.metaPrincipal !== undefined
            ? { meta_principal: dto.metaPrincipal }
            : {}),
          ...(dto.lugarPreferido !== undefined
            ? { lugar_preferido: dto.lugarPreferido }
            : {}),
        },
      },
    };

    const profile = this.clinicProfileRepository.create({
      id: existingProfile?.id,
      userId: dto.userId,
      pesoKg:
        dto.pesoKg !== undefined
          ? String(dto.pesoKg)
          : (existingProfile?.pesoKg ?? null),
      alturaCm:
        dto.alturaCm !== undefined
          ? String(dto.alturaCm)
          : (existingProfile?.alturaCm ?? null),
      edad: dto.edad !== undefined ? dto.edad : (existingProfile?.edad ?? null),
      sexo: dto.sexo !== undefined ? dto.sexo : (existingProfile?.sexo ?? null),
      nivelActividad:
        dto.nivelActividad !== undefined
          ? dto.nivelActividad
          : (existingProfile?.nivelActividad ?? null),
      objetivo:
        dto.objetivo !== undefined
          ? dto.objetivo
          : (existingProfile?.objetivo ?? null),
      condicionFemenina:
        dto.condicionFemenina !== undefined
          ? dto.condicionFemenina
          : (existingProfile?.condicionFemenina ?? {}),
      enfermedades:
        dto.enfermedades !== undefined
          ? dto.enfermedades
          : (existingProfile?.enfermedades ?? []),
      alergias:
        dto.alergias !== undefined
          ? dto.alergias
          : (existingProfile?.alergias ?? []),
      medicamentos:
        dto.medicamentos !== undefined
          ? dto.medicamentos
          : (existingProfile?.medicamentos ?? []),
      biomarcadores:
        dto.biomarcadores !== undefined
          ? dto.biomarcadores
          : (existingProfile?.biomarcadores ?? {}),
      preferenciasLogistica,
    });

    const saved = await this.clinicProfileRepository.save(profile);

    return {
      id: saved.id,
      userId: saved.userId,
      updatedAt: saved.updatedAt,
      action: existingProfile ? 'updated' : 'created',
    };
  }

  async registerClinicProfile(dto: CreateClinicProfileDto) {
    return this.upsertClinicProfile(dto);
  }

  async deleteClinicProfile(dto: DeleteClinicProfileDto) {
    const profile = await this.clinicProfileRepository.findOne({
      where: { userId: dto.userId },
    });

    if (!profile) {
      throw new NotFoundException('No existe perfil clínico para ese usuario');
    }

    await this.clinicProfileRepository.remove(profile);

    return {
      deleted: true,
      userId: dto.userId,
      reason: dto.reason ?? null,
    };
  }
}
