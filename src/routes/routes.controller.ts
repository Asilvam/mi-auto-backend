import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlanRouteDto } from './dto/plan-route.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post('plan')
  plan(@CurrentUser() user: AuthenticatedRequest['user'], @Body() dto: PlanRouteDto) {
    return this.routes.plan(new Types.ObjectId(user.id), dto);
  }
}
