import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { Trip, TripDocument } from './schemas/trip.schema';

@Injectable()
export class TripsService {
  constructor(
    @InjectModel(Trip.name) private readonly trips: Model<TripDocument>,
    private readonly vehicles: VehiclesService,
  ) {}

  async create(userId: Types.ObjectId, dto: CreateTripDto) {
    const vehicle = await this.vehicles.getPrimary(userId);
    const distanceKm = dto.distanceMeters / 1000;
    const fuelCostClp = Math.round((distanceKm / vehicle.efficiencyKmPerLiter) * vehicle.fuelPriceClp);
    const tollsClp = dto.tollsClp ?? 0;
    const otherCostsClp = dto.otherCostsClp ?? 0;

    return this.trips.create({
      userId,
      vehicleId: vehicle._id,
      type: dto.type,
      origin: dto.origin,
      destination: dto.destination,
      distanceMeters: dto.distanceMeters,
      durationSeconds: dto.durationSeconds ?? 0,
      tollsClp,
      otherCostsClp,
      fuelCostClp,
      totalCostClp: fuelCostClp + tollsClp + otherCostsClp,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
    });
  }

  list(userId: Types.ObjectId) {
    return this.trips.find({ userId }).sort({ completedAt: -1 }).limit(100).lean().exec();
  }
}
