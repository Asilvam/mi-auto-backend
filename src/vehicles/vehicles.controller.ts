import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpsertVehicleDto } from './dto/upsert-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequest['user']) {
    return this.vehicles.list(new Types.ObjectId(user.id));
  }

  @Put('primary')
  async savePrimary(@Body() dto: UpsertVehicleDto, @CurrentUser() user: AuthenticatedRequest['user']) {
    return this.vehicles.savePrimary(new Types.ObjectId(user.id), dto);
  }
}
