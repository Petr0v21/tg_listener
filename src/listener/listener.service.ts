import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TelegramClient } from 'telegram';
import input from 'input';
import { AddListenerProps } from './listener';

@Injectable()
export class ListenerService {
  private readonly logger = new Logger(ListenerService.name);
  private listeners: Record<string, TelegramClient> = {};

  constructor(
    @Inject('TG_SENDER_SERVICE') private readonly tgSenderClient: ClientProxy,
  ) {}

  async addListener({
    stringSession,
    apiId,
    apiHash,
    phoneNumber,
  }: AddListenerProps) {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.start({
      phoneNumber: async () => await input.text('Введите номер телефона: '),
      password: async () =>
        await input.text('Введите 2FA пароль (если есть): '),
      phoneCode: async () => await input.text('Введите код подтверждения: '),
      onError: (err) => console.log(err),
    });

    const me = await client.getMe();
    this.logger.log(
      `Started listener for ${me.username} with phone ${phoneNumber}, apiId: ${apiId}`,
    );
    console.log('You login!');
    console.log('Session string:', client.session.save());
    client.addEventHandler(async (update) => {
      if (update.message && update.message.out) {
        const message = update.message.message;
        const senderId = update.message.senderId;
        this.logger.log(`New message from ${senderId}: ${message}`);

        this.tgSenderClient
          .emit('tg.send', {
            payload: {
              message,
              senderId,
            },
            headers: {
              'x-original-routing-key': 'tg.send',
              'message-id': update.message,
            },
          })
          .subscribe({
            error: (err) => {
              this.logger.error('Error at tgSenderClient.emit: ', err);
            },
          });
      }
    });
    this.listeners[apiId] = client;
  }

  async stopListener(apiId: string) {
    if (this.listeners[apiId]) {
      await this.listeners[apiId].destroy();
      delete this.listeners[apiId];
      this.logger.log(`Stopped listener for ${apiId}`);
    }
  }
}
