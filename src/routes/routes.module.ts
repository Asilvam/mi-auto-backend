import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({ imports: [AuthModule, VehiclesModule], controllers: [RoutesController], providers: [RoutesService] })
export class RoutesModule {}
