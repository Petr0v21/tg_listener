import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Api, TelegramClient } from 'telegram';
import { ConfigService } from '@nestjs/config';
import {
  ContentTypeEnum,
  SendMessageMediaType,
  SendMessageToQueueArgs,
  TypeTelegramMessage,
  UploadFileResponse,
} from './listener.types';
import { extension as ext } from 'mime-types';
import { FormData, request } from 'undici';
import { RedisService } from 'src/redis/redis.service';
import { createHash } from 'crypto';
import { fromBuffer } from 'file-type';

@Injectable()
export class ListenerHelperService {
  private readonly logger = new Logger(ListenerHelperService.name);

  constructor(
    @Inject('TG_SENDER_SERVICE') private readonly tgSenderClient: ClientProxy,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  compareUserId(a: any, b: any): boolean {
    const aVal =
      typeof a === 'object' && 'value' in a ? BigInt(a.value) : BigInt(a);
    const bVal =
      typeof b === 'object' && 'value' in b ? BigInt(b.value) : BigInt(b);

    return aVal === bVal;
  }

  async getBufferMedia(client: TelegramClient, event: any, chatId: any) {
    const download = async (media: any) => {
      try {
        const buffer = await client.downloadMedia(media, {
          outputFile: Buffer.alloc(0),
          progressCallback: (received, total) => {
            const _received = received.toJSNumber();
            const _total = total.toJSNumber();
            const percent = ((_received / _total) * 100).toFixed(2);
            this.logger.debug(
              `Downloaded ${received} bytes ${_received}/${_total} (${percent}%)`,
            );
          },
        });

        if (!buffer || typeof buffer === 'string') {
          this.logger.warn('Buffer is string or null, skipping...');
          return null;
        }

        return buffer;
      } catch (err) {
        this.logger.error(`Download error: ${err.message}`);
        return null;
      }
    };

    // 1. Пробуем скачать напрямую
    if (!event?.media) return null;

    let buffer = await download(event.media);
    if (buffer) return buffer;

    // 2. Рефетчим сообщение, если fileReference устарел
    try {
      const freshMsg = await client.getMessages(chatId, { ids: event.id });
      const message = freshMsg[0];
      if (!message?.media) {
        this.logger.warn('Refetched message but no media present');
        return null;
      }

      buffer = await download(message.media);
      return buffer;
    } catch (err) {
      this.logger.error(`Refetching message failed: ${err.message}`);
      return null;
    }
  }

  public async sendBufferToUploader(buffer: Buffer, filename: string) {
    try {
      const form = new FormData();
      const blob = new Blob([buffer]);

      form.append('file', blob, filename);

      const response = await request(
        this.configService.get('UPLOADER_HOST') + '/api/media',
        {
          method: 'POST',
          body: form,
        },
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Upload failed with status ${response.statusCode}`);
      }

      const data = await response.body.json();
      return data as unknown as UploadFileResponse;
    } catch (err) {
      this.logger.error(`Error sendBufferToUploader: ${err}`);
    }
  }

  public async extractMediaFromMessage(
    client: TelegramClient,
    chatId: bigInt.BigInteger,
    event: any,
  ): Promise<SendMessageMediaType | null> {
    if (!event.media) return null;

    let contentType: ContentTypeEnum = ContentTypeEnum.TEXT;
    let extension = 'bin';
    let mimeType = '';

    if (event.media instanceof Api.MessageMediaPhoto) {
      contentType = ContentTypeEnum.PHOTO;
      mimeType = 'image/jpeg';
      extension = 'jpg';
    } else if (event.media instanceof Api.MessageMediaDocument) {
      mimeType = event.media.document?.mimeType ?? '';
      const attributes = event.media.document?.attributes ?? [];

      const isRound = attributes.some(
        (attr: any) =>
          attr instanceof Api.DocumentAttributeVideo && attr.roundMessage,
      );

      const isVoice = attributes.some(
        (attr: any) => attr instanceof Api.DocumentAttributeAudio && attr.voice,
      );

      const isSticker = attributes.some(
        (attr: any) => attr instanceof Api.DocumentAttributeSticker,
      );

      const isAnimated = attributes.some(
        (attr: any) => attr instanceof Api.DocumentAttributeAnimated,
      );

      const hasGifExtension = event.media.document?.attributes?.some(
        (attr: any) =>
          attr.fileName &&
          typeof attr.fileName === 'string' &&
          attr.fileName.endsWith('.gif'),
      );

      if (isSticker) {
        contentType = ContentTypeEnum.STICKER;
        mimeType = mimeType || 'image/webp';
        extension = 'webp';
      } else if (mimeType === 'video/mp4' && (isAnimated || hasGifExtension)) {
        contentType = ContentTypeEnum.ANIMATION;
        mimeType = 'image/gif';
        extension = 'gif';
      } else if (mimeType.startsWith('video/')) {
        contentType = isRound
          ? ContentTypeEnum.VIDEO_NOTE
          : ContentTypeEnum.VIDEO;
      } else if (mimeType.startsWith('audio/')) {
        contentType = isVoice ? ContentTypeEnum.VOICE : ContentTypeEnum.AUDIO;
      } else {
        contentType = ContentTypeEnum.FILE;
      }

      const guessedExt = ext(mimeType);
      if (guessedExt) extension = guessedExt;
    }

    if (contentType === ContentTypeEnum.TEXT) {
      this.logger.warn(
        `Unknown media at update message: ${JSON.stringify(event)}`,
      );
      return null;
    }

    const buffer = await this.getBufferMedia(client, event, chatId);

    if (contentType === ContentTypeEnum.PHOTO) {
      const fileType = await fromBuffer(buffer);
      mimeType = fileType?.mime || 'image/jpeg';
      extension = fileType?.ext || 'jpg';
    }

    const hash = createHash('sha256').update(buffer).digest('hex');

    const _fileName = `${hash}.${extension}`;

    const result = await this.sendBufferToUploader(buffer, _fileName);

    if (!result) {
      return null;
    }

    return {
      contentType,
      fileUrl: result.fileUrl,
    };
  }

  public sendMessage({
    apiId,
    from,
    to,
    text,
    sentAt,
    media,
  }: SendMessageToQueueArgs) {
    return this.tgSenderClient
      .emit('tg.send', {
        payload: {
          botToken: this.configService.get('BOT_TOKEN'),
          chatId: Number(this.configService.get('GROUP_ID')),
          type: TypeTelegramMessage.GROUP,
          contentType: media?.contentType ?? ContentTypeEnum.TEXT,
          fileUrl: media?.fileUrl,
          text: `👤 <b>Пользователь</b> [${apiId}] - <b>${(from.firstName ?? '' + from.lastName ?? '').trim()}</b> ${from.username ? `(${from.username})` : ''}\n↪️ <b>To ${to.title ? '[Group/Channel]' : ''}${to.username ? `[${to.username.slice(-3).toLocaleLowerCase() === 'bot' ? 'Bot' : 'User'}]` : ''}:</b> <b>${to.title ?? (to.firstName ?? '' + to.lastName ?? '').trim()}</b> ${to.username ? `(${to.username})` : ''}${text ? `\n📃<b>Text:</b> ${text.trim()}` : ''}\n🕑 Timestamp (<b>UTC+3</b>): ${new Date(sentAt.setHours(sentAt.getHours() + 3)).toISOString().replace('T', ' ').slice(0, 19)}`,
        },
        headers: {
          'x-original-routing-key': 'tg.send',
          'message-id': `tg-listener-${Date.now()}`,
        },
      })
      .subscribe({
        error: (err) => {
          this.logger.error('Error at tgSenderClient.emit: ', err);
        },
      });
  }

  public async getCachedDialogEntity(client: TelegramClient, userId: any) {
    const cacheKey = `dialog:${userId}`;

    const cachedEntity = await this.redisService.getClient().get(cacheKey);

    if (cachedEntity) {
      return this.redisService.deserialize<Api.User>(cachedEntity);
    }

    try {
      const dialogs = await client.getDialogs({ limit: 100 });
      const dialog = dialogs.find((item) =>
        item.entity ? this.compareUserId(userId, item.entity.id) : false,
      );
      if (!dialog || !dialog.entity || !(dialog.entity instanceof Api.User))
        throw new Error(`Invalid dialog entity`);
      const serializedDialog = this.redisService.serialize(dialog.entity);
      await this.redisService
        .getClient()
        .setex(cacheKey, 60 * 60 * 30, serializedDialog);
      return dialog.entity;
    } catch (err) {
      this.logger.error(`[getCachedDialog] Error: ${err}`);
      return null;
    }
  }
}
