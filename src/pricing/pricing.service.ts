import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DEFAULT_DELIVERY_RATES, isValidRateSchedule, resolveDeliveryRate } from './pricing-calculations';
import { SaveDeliveryPricingDto } from './dto/save-delivery-pricing.dto';
import { DeliveryPricing, DeliveryPricingDocument } from './schemas/delivery-pricing.schema';

@Injectable()
export class PricingService {
  constructor(@InjectModel(DeliveryPricing.name) private readonly pricing: Model<DeliveryPricingDocument>) {}

  async delivery(userId: Types.ObjectId, at = new Date()) {
    const saved = await this.pricing.findOne({ userId }).lean().exec();
    const rules = saved?.rules?.length ? saved.rules : DEFAULT_DELIVERY_RATES;
    return { timeZone: 'America/Santiago', rules, currentRule: resolveDeliveryRate(rules, at) };
  }

  async saveDelivery(userId: Types.ObjectId, dto: SaveDeliveryPricingDto) {
    if (!isValidRateSchedule(dto.rules)) {
      throw new BadRequestException('Los horarios deben ser válidos y no superponerse.');
    }
    return this.pricing.findOneAndUpdate(
      { userId },
      { $set: { rules: dto.rules }, $setOnInsert: { userId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean().exec();
  }
}
