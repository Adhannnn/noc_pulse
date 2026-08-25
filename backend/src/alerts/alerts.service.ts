// backend/src/alerts/alerts.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AlertChannel, AlertChannelType, Monitor } from '@prisma/client';

export interface AlertPayload {
  monitor: Monitor;
  status: 'DOWN' | 'RESOLVED';
  latencyMs?: number;
  statusCode?: number;
  errorMessage?: string;
  downtimeDuration?: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 1. Dispatch alert ke semua channel yang terdaftar
  async dispatchAlert(payload: AlertPayload) {
    const channels = await this.prisma.alertChannel.findMany({
      where: { isEnabled: true },
    });

    if (channels.length === 0) {
      this.logger.debug('No active alert channels configured.');
      return;
    }

    this.logger.log(`Dispatching ${payload.status} alert to ${channels.length} channels...`);

    await Promise.all(
      channels.map(async (channel) => {
        try {
          if (channel.type === AlertChannelType.DISCORD) {
            await this.sendDiscordAlert(channel, payload);
          } else if (channel.type === AlertChannelType.TELEGRAM) {
            await this.sendTelegramAlert(channel, payload);
          }
        } catch (error: any) {
          this.logger.error(`Failed to send alert to channel ${channel.name}:`, error.message);
        }
      }),
    );
  }

  // 2. Format & Kirim ke Discord Webhook (Rich Embed)
  private async sendDiscordAlert(channel: AlertChannel, payload: AlertPayload) {
    if (!channel.webhookUrl) return;

    const isDown = payload.status === 'DOWN';
    const embedColor = isDown ? 15548997 : 5763719; // Merah (#ED4245) vs Hijau (#57F287)
    const title = isDown
      ? `🚨 [ALERT] Service ${payload.monitor.name} is DOWN!`
      : `✅ [RESOLVED] Service ${payload.monitor.name} is Back Online!`;

    const description = isDown
      ? `Service target **${payload.monitor.url || payload.monitor.name}** mengalami kegagalan respons.`
      : `Service target **${payload.monitor.url || payload.monitor.name}** telah kembali normal.`;

    const fields = [
      { name: 'Protocol', value: payload.monitor.type, inline: true },
      { name: 'Latency', value: `${payload.latencyMs || 0} ms`, inline: true },
    ];

    if (payload.statusCode) {
      fields.push({ name: 'HTTP Status', value: `${payload.statusCode}`, inline: true });
    }
    if (payload.errorMessage) {
      fields.push({ name: 'Error Message', value: `\`${payload.errorMessage}\``, inline: false });
    }
    if (payload.downtimeDuration) {
      fields.push({ name: 'Total Downtime', value: payload.downtimeDuration, inline: true });
    }

    await axios.post(channel.webhookUrl, {
      username: 'PulseNOC AlertBot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/9746/9746014.png',
      embeds: [
        {
          title,
          description,
          color: embedColor,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'PulseNOC Monitoring System' },
        },
      ],
    });
  }

  // 3. Format & Kirim ke Telegram Bot API
  private async sendTelegramAlert(channel: AlertChannel, payload: AlertPayload) {
    const token = channel.botToken || process.env.TELEGRAM_DEFAULT_BOT_TOKEN;
    const chatId = channel.chatId || process.env.TELEGRAM_DEFAULT_CHAT_ID;

    if (!token || !chatId) {
      this.logger.warn(`Telegram channel ${channel.name} is missing Bot Token or Chat ID.`);
      return;
    }

    const isDown = payload.status === 'DOWN';
    const icon = isDown ? '🚨' : '✅';
    const statusText = isDown ? '*DOWN*' : '*RESOLVED / UP*';

    let message = `${icon} *PulseNOC Alert: Service ${statusText}*\n\n`;
    message += `*Service:* ${payload.monitor.name}\n`;
    message += `*Target:* \`${payload.monitor.url || '-'}\`\n`;
    message += `*Type:* ${payload.monitor.type}\n`;
    message += `*Latency:* ${payload.latencyMs || 0} ms\n`;

    if (payload.statusCode) message += `*HTTP Status:* ${payload.statusCode}\n`;
    if (payload.errorMessage) message += `*Reason:* \`${payload.errorMessage}\`\n`;
    if (payload.downtimeDuration) message += `*Total Downtime:* ${payload.downtimeDuration}\n`;
    message += `\n_Timestamp: ${new Date().toLocaleString('id-ID')}_`;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });
  }

  // 4. Test Webhook Trigger
  async testChannel(channelId: string) {
    const channel = await this.prisma.alertChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');

    const mockPayload: AlertPayload = {
      monitor: {
        id: 'test-id',
        name: 'Test Service (PulseNOC)',
        type: 'HTTP',
        url: 'https://example.com',
        port: null,
        group: 'Home DC',
        intervalSec: 60,
        timeoutSec: 10,
        lastProbedAt: null,
        isActive: true,
        currentStatus: 'DOWN',
        uptimePercent24h: 99.9,
        dataCenterId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      status: 'DOWN',
      latencyMs: 120,
      statusCode: 500,
      errorMessage: 'Simulated Test Failure',
    };

    if (channel.type === AlertChannelType.DISCORD) {
      await this.sendDiscordAlert(channel, mockPayload);
    } else {
      await this.sendTelegramAlert(channel, mockPayload);
    }

    return { message: `Test alert sent successfully to ${channel.name}` };
  }
}