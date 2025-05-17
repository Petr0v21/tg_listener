export type AddListenerProps = {
  stringSession: string;
  apiId: number;
  apiHash: string;
  phoneNumber: string;
};

export type TelegramShortUserType = {
  username?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
};

export enum ContentTypeEnum {
  TEXT = 'TEXT',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  VIDEO_NOTE = 'VIDEO_NOTE',
  AUDIO = 'AUDIO',
  VOICE = 'VOICE',
  FILE = 'FILE',
  ANIMATION = 'ANIMATION',
  STICKER = 'STICKER',
}

export enum TypeTelegramMessage {
  SINGLE_CHAT = 'SINGLE_CHAT',
  GROUP = 'GROUP',
}

export type SendMessageMediaType = {
  contentType: ContentTypeEnum;
  fileUrl: string;
};

export type SendMessageToQueueArgs = {
  apiId?: string | number;
  text?: string;
  from: TelegramShortUserType;
  to: TelegramShortUserType;
  media?: SendMessageMediaType;
  sentAt: Date;
};

export type UploadFileResponse = {
  fileUrl: string;
  filename: string;
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};
