import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  async create(@Body() dto: CreateTripDto, @CurrentUser() user: AuthenticatedRequest['user']) {
    return this.trips.create(new Types.ObjectId(user.id), dto);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequest['user']) {
    return this.trips.list(new Types.ObjectId(user.id));
  }
}
