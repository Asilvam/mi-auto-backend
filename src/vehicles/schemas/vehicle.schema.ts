import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VehicleDocument = HydratedDocument<Vehicle>;

@Schema({ timestamps: true, versionKey: false })
export class Vehicle {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 60 })
  name: string;

  @Prop({ trim: true, maxlength: 60, default: '' })
  make: string;

  @Prop({ trim: true, maxlength: 60, default: '' })
  model: string;

  @Prop({ min: 1950, max: 2100 })
  year?: number;

  @Prop({ enum: ['gasoline', 'diesel', 'hybrid', 'electric', 'other'], default: 'gasoline' })
  fuelType: string;

  @Prop({ trim: true, maxlength: 160, default: '' })
  baseAddress: string;

  @Prop({ type: [Number], default: undefined })
  baseCoordinates?: [number, number];

  @Prop({ required: true, min: 0.1, max: 100 })
  efficiencyKmPerLiter: number;

  @Prop({ required: true, min: 0, max: 1000000 })
  fuelPriceClp: number;

  @Prop({ default: true })
  isPrimary: boolean;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.index({ userId: 1, isPrimary: -1, createdAt: -1 });
