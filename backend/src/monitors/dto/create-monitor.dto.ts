// backend/src/monitors/dto/create-monitor.dto.ts
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { MonitorType } from '@prisma/client';

export class CreateMonitorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(MonitorType)
  @IsOptional()
  type?: MonitorType = MonitorType.HTTP;

  @IsString()
  @IsOptional()
  url?: string;

  @IsInt()
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  group?: string;

  @IsInt()
  @Min(10)
  @Max(3600)
  @IsOptional()
  intervalSec?: number = 60;

  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  timeoutSec?: number = 10;
}