import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ListenerService } from './listener.service';
import { ListenerResolver } from './graphql/listener.resolver';
import { PrismaModule } from 'prisma/prisma.module';
import { ListenerHelperService } from './listener-handler.service';

@Module({
  imports: [
    PrismaModule,
    ClientsModule.registerAsync([
      {
        name: 'TG_SENDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: configService.get<string>('RABBITMQ_PUSH_QUEUE'),
            noAck: true,
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 60000,
                'x-dead-letter-exchange': 'dlx_exchange',
                'x-dead-letter-routing-key': 'dlx_routing_key',
              },
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [ListenerService, ListenerHelperService, ListenerResolver],
  exports: [ListenerService],
})
export class ListenerModule {}
