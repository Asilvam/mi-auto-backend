import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlanRouteDto } from './dto/plan-route.dto';
import { SearchPlacesDto } from './dto/search-places.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get('places')
  searchPlaces(@Query() query: SearchPlacesDto) {
    return this.routes.searchPlaces(query.q);
  }

  @Post('plan')
  plan(@CurrentUser() user: AuthenticatedRequest['user'], @Body() dto: PlanRouteDto) {
    return this.routes.plan(new Types.ObjectId(user.id), dto);
  }
}
