import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  const rabbitUrl = process.env.RABBITMQ_URL;
  const rabbitQueue = process.env.RABBITMQ_LISTEN_QUEUE;

  if (!rabbitUrl || !rabbitQueue) {
    console.log('Doesn`t exist envs RABBITMQ_URL and/or RABBITMQ_LISTEN_QUEUE');
    process.exit(1);
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: rabbitQueue, //add-listener
      noAck: false,
      queueOptions: {
        durable: true,
        // arguments: {
        //   'x-message-ttl': 60000,
        //   'x-dead-letter-exchange': 'dlx_exchange',
        //   'x-dead-letter-routing-key': 'dlx_routing_key',
        // },
      },
    },
  });

  await app.startAllMicroservices();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  console.log(
    `✅ TgListener listening on HTTP port ${port} and RabbitMQ queue ${rabbitQueue}`,
  );
}
bootstrap();
