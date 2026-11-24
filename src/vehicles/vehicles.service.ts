import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpsertVehicleDto } from './dto/upsert-vehicle.dto';
import { Vehicle, VehicleDocument } from './schemas/vehicle.schema';

@Injectable()
export class VehiclesService {
  constructor(@InjectModel(Vehicle.name) private readonly vehicles: Model<VehicleDocument>) {}

  list(userId: Types.ObjectId) {
    return this.vehicles.find({ userId }).sort({ isPrimary: -1, createdAt: -1 }).lean().exec();
  }

  async savePrimary(userId: Types.ObjectId, dto: UpsertVehicleDto) {
    const current = await this.vehicles.findOne({ userId, isPrimary: true }).exec();
    await this.vehicles.updateMany(
      { userId, ...(current ? { _id: { $ne: current._id } } : {}) },
      { $set: { isPrimary: false } },
    ).exec();
    if (!current) {
      return this.vehicles.create({ ...dto, userId, isPrimary: true });
    }
    Object.assign(current, dto, { isPrimary: true });
    return current.save();
  }

  async getPrimary(userId: Types.ObjectId) {
    const vehicle = await this.vehicles.findOne({ userId, isPrimary: true }).lean().exec();
    if (!vehicle) throw new NotFoundException('Primero debes configurar tu vehículo.');
    return vehicle;
  }
}
