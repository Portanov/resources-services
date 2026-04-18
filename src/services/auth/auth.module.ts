import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserEntity } from './entities/user.entity';
import { ClinicProfileEntity } from './entities/clinic-profile.entity';
import { ClinicProfileService } from './clinic-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ClinicProfileEntity])],
  providers: [AuthService, ClinicProfileService],
  controllers: [AuthController],
  exports: [AuthService, ClinicProfileService],
})
export class AuthModule {}
