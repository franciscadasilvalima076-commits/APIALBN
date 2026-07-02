import { ApiClient } from '../ApiClient';

export class DiscordClient extends ApiClient {
  private static instance: DiscordClient;
  private webhookUrl: string | undefined;

  private constructor() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    super({
      name: 'Discord',
      baseUrl: webhookUrl || 'https://discord.com/api/webhooks',
      apiKey: webhookUrl,
      rateLimitRequestsPerMin: 30,
    });
    this.webhookUrl = webhookUrl;
  }

  public static getInstance(): DiscordClient {
    if (!DiscordClient.instance) {
      DiscordClient.instance = new DiscordClient();
    }
    return DiscordClient.instance;
  }

  /**
   * Sends rich Embed log metrics or alerts directly to a Discord Channel
   */
  public async sendAlert(title: string, description: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO'): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        throw new Error('Discord Webhook URL is not configured.');
      }

      // Map levels to color hex codes
      const colors = {
        INFO: 3447003,    // Blue
        SUCCESS: 3066993, // Green
        WARN: 15105570,   // Orange
        ERROR: 15158332,  // Red
      };

      const res = await this.request<any>('', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [
            {
              title: `🛡️ Quantitative System: ${title}`,
              description,
              color: colors[level],
              timestamp: new Date().toISOString(),
              footer: {
                text: 'Multi-Asset Trading Engine v4.0',
              },
            }
          ],
        }),
      });

      this.logger.system('DISCORD_ALERTS', 'Webhook payload dispatched successfully.', 'SUCCESS');
      return true;
    } catch (err: any) {
      this.logger.system(
        'DISCORD_ALERTS',
        `No webhook URL or error. Discord payload logged locally: [${level}] ${title} - ${description.substring(0, 100)}...`,
        'INFO'
      );
      return false;
    }
  }

  public override async checkHealth(): Promise<boolean> {
    return this.webhookUrl !== undefined;
  }
}
