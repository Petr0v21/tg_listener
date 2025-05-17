import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ListenerModule } from './listener/listener.module';
import { PrismaModule } from 'prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      autoSchemaFile: 'schema.gql',
      introspection: process.env.NODE_ENV === 'production' ? true : undefined,
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get<string>('REDIS_PASSWORD'),
        db: configService.get<number>('REDIS_DB') ?? 0,
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    HealthModule,
    ListenerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
