import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClinicalFilterModule } from './services/clinical-filter/clinical-filter.module';
import { NutricionalCalculatorModule } from './services/nutricional-calculator/nutricional-calculator.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ExercisePlanModule } from './services/excercise-plan/excercise-plan.module';
import { AuthModule } from './services/auth/auth.module';
@Module({
  imports: [
    AuthModule,
    NutricionalCalculatorModule,
    ClinicalFilterModule,
    ExercisePlanModule,
    // Removed invalid character 'A'
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.database_url,
      autoLoadEntities: true,
      synchronize: false,
      logging: false,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: 'holos',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
