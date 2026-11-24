import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SaveDeliveryPricingDto } from './dto/save-delivery-pricing.dto';
import { PricingService } from './pricing.service';

@Controller('pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('delivery')
  delivery(@CurrentUser() user: AuthenticatedRequest['user'], @Query('at') at?: string) {
    const date = at ? new Date(at) : new Date();
    return this.pricing.delivery(new Types.ObjectId(user.id), Number.isNaN(date.getTime()) ? new Date() : date);
  }

  @Put('delivery')
  saveDelivery(@CurrentUser() user: AuthenticatedRequest['user'], @Body() dto: SaveDeliveryPricingDto) {
    return this.pricing.saveDelivery(new Types.ObjectId(user.id), dto);
  }
}
