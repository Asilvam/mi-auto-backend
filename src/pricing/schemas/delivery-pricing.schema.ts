import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeliveryPricingDocument = HydratedDocument<DeliveryPricing>;

@Schema({ _id: false })
export class DeliveryRate {
  @Prop({ required: true }) id: string;
  @Prop({ required: true, trim: true, maxlength: 40 }) label: string;
  @Prop({ required: true }) startTime: string;
  @Prop({ required: true }) endTime: string;
  @Prop({ required: true, min: 0 }) amountClp: number;
}

export const DeliveryRateSchema = SchemaFactory.createForClass(DeliveryRate);

@Schema({ timestamps: true, versionKey: false })
export class DeliveryPricing {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [DeliveryRateSchema], required: true })
  rules: DeliveryRate[];
}

export const DeliveryPricingSchema = SchemaFactory.createForClass(DeliveryPricing);
