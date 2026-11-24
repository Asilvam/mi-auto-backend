import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { calculateTripCosts } from '../pricing/pricing-calculations';
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
    const costs = calculateTripCosts({
      type: dto.type as 'shared' | 'delivery',
      distanceMeters: dto.distanceMeters,
      efficiencyKmPerLiter: vehicle.efficiencyKmPerLiter,
      fuelPriceClp: vehicle.fuelPriceClp,
      tollsClp: dto.tollsClp,
      otherCostsClp: dto.otherCostsClp,
      deliveryFeeClp: dto.deliveryFeeClp,
      participantCount: dto.participantCount,
    });

    return this.trips.create({
      userId,
      vehicleId: vehicle._id,
      type: dto.type,
      status: dto.status ?? 'completed',
      origin: dto.origin,
      destination: dto.destination,
      distanceMeters: dto.distanceMeters,
      durationSeconds: dto.durationSeconds ?? 0,
      tollsClp: costs.tollsClp,
      otherCostsClp: costs.otherCostsClp,
      fuelCostClp: costs.fuelCostClp,
      totalCostClp: costs.totalCostClp,
      participantCount: dto.type === 'shared' ? Math.max(1, dto.participantCount ?? 1) : 1,
      costPerParticipantClp: costs.costPerParticipantClp,
      deliveryFeeClp: costs.deliveryFeeClp,
      stops: dto.stops ?? [],
      routeGeometry: dto.routeGeometry,
      startedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
      ...(dto.status === 'in_progress' ? {} : { completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date() }),
    });
  }

  list(userId: Types.ObjectId) {
    return this.trips.find({ userId }).sort({ startedAt: -1 }).limit(100).lean().exec();
  }

  async updateActiveDelivery(userId: Types.ObjectId, tripId: string, dto: import('./dto/update-active-route.dto').UpdateActiveRouteDto) {
    const trip = await this.trips.findOne({ _id: tripId, userId, type: 'delivery', status: 'in_progress' }).exec();
    if (!trip) throw new NotFoundException('No hay una entrega activa con ese identificador.');
    const vehicle = await this.vehicles.getPrimary(userId);
    const costs = calculateTripCosts({
      type: 'delivery', distanceMeters: dto.distanceMeters,
      efficiencyKmPerLiter: vehicle.efficiencyKmPerLiter, fuelPriceClp: vehicle.fuelPriceClp,
      tollsClp: dto.tollsClp ?? trip.tollsClp, otherCostsClp: trip.otherCostsClp,
      deliveryFeeClp: trip.deliveryFeeClp,
    });
    Object.assign(trip, {
      distanceMeters: dto.distanceMeters,
      durationSeconds: dto.durationSeconds ?? trip.durationSeconds,
      tollsClp: costs.tollsClp,
      fuelCostClp: costs.fuelCostClp,
      totalCostClp: costs.totalCostClp,
      stops: dto.stops ?? trip.stops,
      routeGeometry: dto.routeGeometry,
    });
    return trip.save();
  }

  async completeDelivery(userId: Types.ObjectId, tripId: string) {
    const trip = await this.trips.findOneAndUpdate(
      { _id: tripId, userId, type: 'delivery', status: 'in_progress' },
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: true },
    ).exec();
    if (!trip) throw new NotFoundException('No hay una entrega activa con ese identificador.');
    return trip;
  }
}
