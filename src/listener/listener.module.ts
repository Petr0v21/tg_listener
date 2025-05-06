ClientsModule.registerAsync([
    {
      name: 'TG_SENDER_SERVICE',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        transport: Transport.RMQ,
        options: {
          urls: [configService.get<string>('RABBITMQ_URL')],
          queue: configService.get<string>('RABBITMQ_QUEUE'),
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