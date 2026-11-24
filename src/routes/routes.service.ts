import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { VehiclesService } from '../vehicles/vehicles.service';
import { rankRoutes, scoreRoute } from './route-scoring';
import { PlanRouteDto } from './dto/plan-route.dto';

type MapboxFeature = { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; full_address?: string }; place_name?: string };
type MapboxRoute = { distance: number; duration: number; geometry: { type: 'LineString'; coordinates: [number, number][] }; legs?: Array<{ distance: number; duration: number }> };

@Injectable()
export class RoutesService {
  private readonly token?: string;
  constructor(config: ConfigService, private readonly vehicles: VehiclesService) {
    this.token = config.get<string>('MAPBOX_ACCESS_TOKEN') || undefined;
  }

  async plan(userId: Types.ObjectId, dto: PlanRouteDto) {
    if (!this.token) throw new ServiceUnavailableException('Configura MAPBOX_ACCESS_TOKEN en el backend para calcular rutas.');
    const vehicle = await this.vehicles.getPrimary(userId);
    const labels = [dto.origin, ...(dto.stops ?? []), dto.destination];
    if (labels.length > 12) throw new BadRequestException('Mapbox admite hasta 12 ubicaciones por ruta.');
    const locations = await Promise.all(labels.map((label) => this.geocode(label)));
    const ordered = await this.optimize(locations);
    const alternatives = await this.directions(ordered);
    const evaluated = alternatives.map((route, index) => ({
      id: `route-${index + 1}`,
      ...scoreRoute(route.distance, route.duration, vehicle.efficiencyKmPerLiter, vehicle.fuelPriceClp, dto.tollsClp ?? 0, dto.otherCostsClp ?? 0),
      geometry: route.geometry,
      stopOrder: ordered.map((location) => location.label),
    }));
    const ranked = rankRoutes(evaluated);
    return {
      provider: 'mapbox',
      optimizedStops: (dto.stops?.length ?? 0) > 0,
      preferences: { economical: ranked.economical, fastest: ranked.fastest },
      alternatives: ranked.routes,
      tollsEstimated: false,
      notice: 'Los peajes no están incluidos automáticamente; ingresa su costo para compararlos.',
    };
  }

  private async geocode(label: string) {
    const query = new URLSearchParams({
      q: `${label}, Quintero, Valparaíso, Chile`,
      country: 'cl',
      proximity: '-71.5333,-32.7833',
      limit: '1',
      access_token: this.token!,
    });
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${query}`);
    if (!response.ok) throw new ServiceUnavailableException('Mapbox no pudo buscar una de las ubicaciones.');
    const data = await response.json() as { features?: MapboxFeature[] };
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) throw new BadRequestException(`No encontré la ubicación: ${label}.`);
    return { label, coordinates };
  }

  private async optimize(locations: Array<{ label: string; coordinates: [number, number] }>) {
    if (locations.length < 3) return locations;
    const coordinates = locations.map((location) => location.coordinates.join(',')).join(';');
    const query = new URLSearchParams({
      source: 'first', destination: 'last', roundtrip: 'false', geometries: 'geojson',
      access_token: this.token!,
    });
    const response = await fetch(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?${query}`);
    if (!response.ok) throw new ServiceUnavailableException('Mapbox no pudo ordenar las paradas.');
    const data = await response.json() as { code?: string; waypoints?: Array<{ waypoint_index: number }> };
    if (data.code !== 'Ok' || !data.waypoints?.length) throw new BadRequestException('No se pudo optimizar el orden de las paradas.');
    return data.waypoints
      .map((waypoint, inputIndex) => ({ waypointIndex: waypoint.waypoint_index, location: locations[inputIndex] }))
      .sort((left, right) => left.waypointIndex - right.waypointIndex)
      .map(({ location }) => location)
      .filter(Boolean);
  }

  private async directions(locations: Array<{ label: string; coordinates: [number, number] }>): Promise<MapboxRoute[]> {
    const coordinates = locations.map((location) => location.coordinates.join(',')).join(';');
    const query = new URLSearchParams({
      alternatives: 'true', geometries: 'geojson', overview: 'full', steps: 'false',
      access_token: this.token!,
    });
    const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${query}`);
    if (!response.ok) throw new ServiceUnavailableException('Mapbox no pudo calcular la ruta.');
    const data = await response.json() as { code?: string; routes?: MapboxRoute[] };
    if (data.code !== 'Ok' || !data.routes?.length) throw new BadRequestException('Mapbox no encontró una ruta para esos puntos.');
    return data.routes;
  }
}
