import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

export const regexDateTimeISOString =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  getClient() {
    return this.redis;
  }

  serialize(obj: any): string {
    return JSON.stringify(obj);
  }

  convertObjectWithDate<T>(args: T): T {
    Object.entries(args).map((item) => {
      if (typeof item[1] === 'object' && item[1] !== null) {
        const convertedData = this.convertObjectWithDate(item[1]);
        args[item[0]] = convertedData;
      } else if (
        typeof item[1] === 'string' &&
        regexDateTimeISOString.test(item[1])
      ) {
        args[item[0]] = new Date(item[1]);
      }
    });
    return args;
  }

  deserialize<T>(data: string | null): T | null {
    if (!data) {
      return null;
    }
    const result = JSON.parse(data);
    return this.convertObjectWithDate<T>(result);
  }
}
