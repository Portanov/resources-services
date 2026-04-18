import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateUserProfileDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async getUserById(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      username: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUserProfile(id: string, dto: UpdateUserProfileDto) {
    if (!dto.email && !dto.username) {
      throw new BadRequestException(
        'Debes enviar al menos email o username para actualizar',
      );
    }

    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedEmail = dto.email?.toLowerCase().trim();
    const normalizedUsername = dto.username?.trim();

    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(
          'El correo ya está en uso por otro usuario',
        );
      }

      user.email = normalizedEmail;
    }

    if (normalizedUsername) {
      user.name = normalizedUsername;
    }

    const updatedUser = await this.userRepository.save(user);

    return {
      id: updatedUser.id,
      username: updatedUser.name,
      email: updatedUser.email,
      isActive: updatedUser.isActive,
      updatedAt: updatedUser.updatedAt,
    };
  }
}
