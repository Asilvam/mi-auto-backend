import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPricing, DeliveryPricingSchema } from './schemas/delivery-pricing.schema';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: DeliveryPricing.name, schema: DeliveryPricingSchema }]), AuthModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
