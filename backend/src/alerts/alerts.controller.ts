// backend/src/alerts/alerts.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertChannelType } from '@prisma/client';

@Controller('api/alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('channels')
  findAllChannels() {
    return this.prisma.alertChannel.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('channels')
  createChannel(
    @Body()
    body: {
      name: string;
      type: AlertChannelType;
      webhookUrl?: string;
      chatId?: string;
      botToken?: string;
    },
  ) {
    return this.prisma.alertChannel.create({
      data: body,
    });
  }

  @Post('channels/:id/test')
  testAlert(@Param('id') id: string) {
    return this.alertsService.testChannel(id);
  }

  @Delete('channels/:id')
  deleteChannel(@Param('id') id: string) {
    return this.prisma.alertChannel.delete({
      where: { id },
    });
  }
}