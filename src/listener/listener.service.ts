import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Api, TelegramClient } from 'telegram';
import input from 'input';
import { ConfigService } from '@nestjs/config';
import { ListenerOutput } from './graphql/output/listener.output';
import { CreateListenerArgs } from './graphql/args/CreateListenerArgs';
import { StringSession } from 'telegram/sessions';
import { PrismaService } from 'prisma/prisma.service';
import { ListenerHelperService } from './listener-handler.service';

@Injectable()
export class ListenerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ListenerService.name);
  private listeners: Record<string, TelegramClient> = {};

  avalibleClassNameMesasge = ['UpdateNewChannelMessage', 'UpdateNewMessage'];

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly helperService: ListenerHelperService,
  ) {}

  async onModuleInit(): Promise<void> {
    const dblisteners = await this.prismaService.listener.findMany({
      where: {
        isActive: false,
      },
    });
    if (!dblisteners.length) return;

    for (let i = 0; i < dblisteners.length; i++) {
      const listener = dblisteners[i];
      try {
        await this.addListener({ ...listener });
      } catch (err) {
        this.logger.error(
          `Error with listener (${listener.apiId}): ${err.message}`,
        );
      }
    }
  }

  async onApplicationShutdown() {
    await this.prismaService.listener.updateMany({
      where: {
        apiId: {
          in: Object.keys(this.listeners).map((apiId) => Number(apiId)),
        },
      },
      data: { isActive: false },
    });
  }

  findListeners(): ListenerOutput[] {
    return Object.keys(this.listeners).map((apiId) => ({
      apiId: Number(apiId),
    }));
  }

  async addListener({
    stringSession,
    apiId,
    apiHash,
    phone,
  }: CreateListenerArgs) {
    if (this.listeners[apiId]) {
      throw new Error('We already listening this user!');
    }

    const limit = this.configService.get<number>('LISTENERS_LIMIT');

    if (limit && Object.keys(this.listeners).length > Number(limit)) {
      throw new Error(`This service havea all listeners. LIMIT: ${limit}`);
    }

    const session = new StringSession(stringSession);

    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.start({
      phoneNumber: phone,
      password: async () =>
        await input.text('Введите 2FA пароль (если есть): '),
      phoneCode: async () => await input.text('Введите код подтверждения: '),
      onError: (err) => this.logger.error(err),
    });

    const me = await client.getMe();

    this.logger.log(
      `Started listener for ${me.username} with phone ${phone}, apiId: ${apiId}`,
    );
    this.logger.log(
      `Session string of user (@${me.username}) with apiId (${apiId})!: ${client.session.save()}`,
    );

    await this.prismaService.listener.upsert({
      where: {
        apiId,
      },
      create: {
        apiId,
        apiHash,
        phone,
        stringSession,
        username: me.username,
        firstName: me.firstName,
        lastName: me.firstName,
        isActive: true,
      },
      update: {
        stringSession,
        isActive: true,
        username: me.username,
        firstName: me.firstName,
        lastName: me.firstName,
      },
    });

    client.addEventHandler(async (update) => {
      if (update.className === 'UpdateShortMessage' && update.out) {
        const sentAt = new Date(update.date * 1000);
        console.log(sentAt.toISOString());

        this.logger.log(
          `New short message from ${me.id} (@${me.username}) to ${update.userId}`,
        );
        const userId = update.userId;
        try {
          const entity = await this.helperService.getCachedDialogEntity(
            client,
            userId,
          );

          if (!entity) return;

          this.helperService.sendMessage({
            apiId,
            from: me,
            to: entity,
            text: update.message,
            sentAt,
          });
        } catch (err) {
          this.logger.error(`Error short message: ${err}`);
        }
      } else if (
        this.avalibleClassNameMesasge.includes(update.className) &&
        update.message &&
        update.message.out
      ) {
        const sentAt = new Date(update.message.date * 1000);

        this.logger.log(
          `New message from ${me.id} (@${me.username}) to ${update.message.peerId?.chatId ?? update.message.peerId?.userId ?? update.message.peerId?.channelId}`,
        );
        const message = update.message.message;

        const peer = update.message.peerId;
        try {
          const entity = (await client.getEntity(peer)) as
            | Api.User
            | Api.Channel
            | Api.Chat;

          const media = await this.helperService.extractMediaFromMessage(
            client,
            entity.id,
            update.message,
          );

          this.helperService.sendMessage({
            apiId,
            from: me,
            to: entity,
            text: message,
            media: media ?? undefined,
            sentAt,
          });
        } catch (err) {
          this.logger.error(
            `[${apiId}] Error event handler: ${err?.message} (${err})`,
          );
        }
      }
    });
    this.listeners[apiId] = client;
    return { apiId };
  }

  async stopListener(apiId: number) {
    if (!this.listeners[apiId]) {
      throw new Error('Can`t find this listener!');
    }
    await this.listeners[apiId].destroy();
    delete this.listeners[apiId];
    await this.prismaService.listener.delete({
      where: {
        apiId,
      },
    });
    this.logger.log(`Stopped listener (${apiId})`);
  }
}
