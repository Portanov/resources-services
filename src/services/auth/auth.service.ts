import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { UserEntity } from './entities/user.entity';
import { LoginDto, RegisterUserDto } from './dto/user.dto';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async register(dto: RegisterUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = this.userRepository.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    return {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
      isActive: savedUser.isActive,
      createdAt: savedUser.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await this.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
    };
  }

  private async hashPassword(plainPassword: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(plainPassword, salt, 64)) as Buffer;

    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    plainPassword: string,
    storedHash: string,
  ): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');

    if (!salt || !hash) {
      return false;
    }

    const storedBuffer = Buffer.from(hash, 'hex');
    const derivedBuffer = (await scrypt(plainPassword, salt, 64)) as Buffer;

    if (storedBuffer.length !== derivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, derivedBuffer);
  }
}
