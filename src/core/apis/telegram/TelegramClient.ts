import { ApiClient } from '../ApiClient';

export class TelegramClient extends ApiClient {
  private static instance: TelegramClient;
  private chatId: string | undefined;

  private constructor() {
    // Default fallback to user-supplied token if environment variable is not set
    const token = process.env.TELEGRAM_BOT_TOKEN || '6840980052:AAF49VAZAhCcLtn6iRWYY8B3_F_ngVsZTUY';
    super({
      name: 'Telegram',
      baseUrl: `https://api.telegram.org/bot${token}`,
      apiKey: token,
      rateLimitRequestsPerMin: 30,
    });
    this.chatId = process.env.TELEGRAM_CHAT_ID;
  }

  public static getInstance(): TelegramClient {
    if (!TelegramClient.instance) {
      TelegramClient.instance = new TelegramClient();
    }
    return TelegramClient.instance;
  }

  public setChatId(chatId: string) {
    this.chatId = chatId;
  }

  public getChatId(): string | undefined {
    return this.chatId;
  }

  public getBotToken(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * Dispatches trading alerts or notifications directly to Telegram Bot API
   */
  public async sendNotification(message: string): Promise<boolean> {
    try {
      if (!this.config.apiKey || !this.chatId) {
        throw new Error('Telegram Bot Token or Chat ID is not configured.');
      }

      const res = await this.request<any>('/sendMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: `[QUANT_BOT] 🤖\n\n${message}`,
          parse_mode: 'HTML',
        }),
      });

      if (res && res.ok) {
        this.logger.system('TELEGRAM_ALERTS', 'Notification dispatched successfully to channel.', 'SUCCESS');
        return true;
      }
      return false;
    } catch (err: any) {
      this.logger.system(
        'TELEGRAM_ALERTS',
        `No credentials/error. Telegram notification logged locally: "${message.substring(0, 100)}..."`,
        'INFO'
      );
      return false;
    }
  }

  public override async checkHealth(): Promise<boolean> {
    return this.config.apiKey !== undefined && this.chatId !== undefined;
  }
}
