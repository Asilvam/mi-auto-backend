import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TripDocument = HydratedDocument<Trip>;

@Schema({ timestamps: true, versionKey: false })
export class Trip {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: Types.ObjectId;

  @Prop({ required: true, enum: ['shared', 'delivery'] })
  type: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  origin: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  destination: string;

  @Prop({ required: true, min: 1 })
  distanceMeters: number;

  @Prop({ min: 0, default: 0 })
  durationSeconds: number;

  @Prop({ min: 0, default: 0 })
  tollsClp: number;

  @Prop({ min: 0, default: 0 })
  otherCostsClp: number;

  @Prop({ required: true, min: 0 })
  fuelCostClp: number;

  @Prop({ required: true, min: 0 })
  totalCostClp: number;

  @Prop({ required: true, default: Date.now })
  completedAt: Date;
}

export const TripSchema = SchemaFactory.createForClass(Trip);
TripSchema.index({ userId: 1, completedAt: -1 });
