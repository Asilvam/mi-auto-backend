import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 5000,
        lazyConnection: true,
        connectionFactory: (connection) => {
          connection.on('error', (error: Error) => {
            console.error('[MongoDB] conexión no disponible:', error.message);
          });
          return connection;
        },
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    TripsModule,
  ],
})
export class AppModule {}
