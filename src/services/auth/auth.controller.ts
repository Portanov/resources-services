import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ClinicProfileService } from './clinic-profile.service';
import {
  LoginDto,
  RegisterUserDto,
  UpdateUserProfileDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly clinicProfileService: ClinicProfileService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('users/:id')
  getUserById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch('users/:id')
  updateUserProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateUserProfile(id, dto);
  }

  @Get('users/:id/clinical-profile')
  getClinicalProfile(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clinicProfileService.getClinicProfileByUserId(id);
  }
}
