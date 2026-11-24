import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import axios from 'axios';
import { VehiclesService } from '../vehicles/vehicles.service';
import { rankRoutes, scoreRoute } from './route-scoring';
import { PlanRouteDto } from './dto/plan-route.dto';
import { GeographyScope, geographyLabel, matchesGeographyScope } from './geography-scope';
import { splitRouteGeometry, type RouteGeometry } from './route-segments';

type MapboxFeature = { id?: string; geometry?: { coordinates?: [number, number] }; properties?: { name?: string; full_address?: string; place_formatted?: string; context?: { region?: { name?: string }; place?: { name?: string }; locality?: { name?: string }; district?: { name?: string } } }; place_name?: string };
type MapboxRoute = { distance: number; duration: number; geometry: RouteGeometry; legs?: Array<{ distance: number; duration: number; steps?: Array<{ geometry?: RouteGeometry }> }> };

@Injectable()
export class RoutesService {
  private readonly token?: string;
  constructor(config: ConfigService, private readonly vehicles: VehiclesService) {
    this.token = config.get<string>('MAPBOX_ACCESS_TOKEN') || undefined;
  }

  async searchPlaces(searchText: string, scope: GeographyScope = 'quintero') {
    if (!this.token) throw new ServiceUnavailableException('Configura MAPBOX_ACCESS_TOKEN en el backend para buscar ubicaciones.');
    const text = searchText.trim();
    if (text.length < 3) throw new BadRequestException('Escribe al menos 3 caracteres para buscar una ubicación.');
    const query = new URLSearchParams({
      q: `${text}, ${scope === 'quintero' ? 'Quintero, ' : ''}Región de Valparaíso, Chile`,
      country: 'cl',
      proximity: '-71.5333,-32.7833',
      limit: '5',
      access_token: this.token,
    });
    const data = await this.mapboxGet<{ features?: MapboxFeature[] }>(`https://api.mapbox.com/search/geocode/v6/forward?${query}`, 'Mapbox no pudo buscar las ubicaciones.');
    return (data.features ?? []).filter((feature) => matchesGeographyScope(feature, scope)).flatMap((feature) => {
      const coordinates = feature.geometry?.coordinates;
      const fullAddress = feature.properties?.full_address ?? feature.place_name ?? feature.properties?.name;
      if (!coordinates || coordinates.length < 2 || !fullAddress) return [];
      return [{
        id: feature.id ?? `${coordinates[0]},${coordinates[1]}`,
        name: feature.properties?.name ?? fullAddress,
        fullAddress,
        coordinates,
      }];
    });
  }

  async plan(userId: Types.ObjectId, dto: PlanRouteDto) {
    if (!this.token) throw new ServiceUnavailableException('Configura MAPBOX_ACCESS_TOKEN en el backend para calcular rutas.');
    const vehicle = await this.vehicles.getPrimary(userId);
    const isDelivery = dto.type === 'delivery';
    const scope: GeographyScope = isDelivery ? 'quintero' : 'valparaiso';
    if (isDelivery && !(dto.stops?.length)) throw new BadRequestException('Agrega al menos una parada para calcular el delivery.');
    const labels = isDelivery ? [dto.origin, ...(dto.stops ?? [])] : [dto.origin, dto.destination, dto.origin];
    if (labels.length > 12) throw new BadRequestException('Mapbox admite hasta 12 ubicaciones por ruta.');
    const savedBaseAddress = vehicle.baseAddress?.trim();
    const savedBaseCoordinates = vehicle.baseCoordinates?.length === 2 ? vehicle.baseCoordinates as [number, number] : undefined;
    const pickedDestinationCoordinates = !isDelivery && dto.destinationCoordinates
      ? await this.validatePointScope(dto.destinationCoordinates, scope)
      : undefined;
    const locations = await Promise.all(labels.map((label, index) => {
      if (!isDelivery && index === 1 && pickedDestinationCoordinates) {
        return Promise.resolve({ label, coordinates: pickedDestinationCoordinates });
      }
      if (savedBaseCoordinates && savedBaseAddress && label.trim() === savedBaseAddress) {
        return Promise.resolve({ label, coordinates: savedBaseCoordinates });
      }
      return this.geocode(label, scope);
    }));
    const orderedStops = isDelivery ? await this.optimizeDelivery(locations) : locations;
    const routeLocations = isDelivery
      ? [...orderedStops, orderedStops[0]]
      : orderedStops;
    const alternatives = await this.directions(routeLocations);
    const evaluated = alternatives.map((route, index) => {
      const distanceMeters = Math.round(route.distance);
      const durationSeconds = Math.round(route.duration);
      const { outboundGeometry, returnGeometry } = splitRouteGeometry(route.geometry, route.legs);
      return {
      id: `route-${index + 1}`,
      ...scoreRoute(distanceMeters, durationSeconds, vehicle.efficiencyKmPerLiter, vehicle.fuelPriceClp, dto.tollsClp ?? 0, dto.otherCostsClp ?? 0),
      fareDistanceMeters: isDelivery ? null : Math.round(route.legs?.[0]?.distance ?? route.distance / 2),
      fareDurationSeconds: isDelivery ? null : Math.round(route.legs?.[0]?.duration ?? route.duration / 2),
      geometry: route.geometry,
      outboundGeometry,
      returnGeometry,
      stopOrder: routeLocations.map((location) => location.label),
      };
    });
    const ranked = rankRoutes(evaluated);
    return {
      provider: 'mapbox',
      optimizedStops: isDelivery && (dto.stops?.length ?? 0) > 1,
      preferences: { economical: ranked.economical, fastest: ranked.fastest },
      alternatives: ranked.routes,
      tollsEstimated: false,
      notice: `${isDelivery ? 'Las entregas se ordenan antes de volver al punto base. ' : 'La ruta considera ida y regreso al punto base. '}Los peajes no están incluidos automáticamente; ingresa su costo para compararlos.`,
    };
  }

  private async geocode(label: string, scope: GeographyScope) {
    const query = new URLSearchParams({
      q: `${label}, ${scope === 'quintero' ? 'Quintero, ' : ''}Región de Valparaíso, Chile`,
      country: 'cl',
      proximity: '-71.5333,-32.7833',
      limit: '5',
      access_token: this.token!,
    });
    const data = await this.mapboxGet<{ features?: MapboxFeature[] }>(`https://api.mapbox.com/search/geocode/v6/forward?${query}`, 'Mapbox no pudo buscar una de las ubicaciones.');
    const feature = data.features?.find((candidate) => matchesGeographyScope(candidate, scope));
    const coordinates = feature?.geometry?.coordinates;
    if (!feature || !coordinates || coordinates.length < 2) {
      throw new BadRequestException(`La ubicación debe estar dentro de ${geographyLabel(scope)}.`);
    }
    return { label, coordinates };
  }

  private async validatePointScope(coordinates: number[], scope: GeographyScope): Promise<[number, number]> {
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new BadRequestException('Las coordenadas del destino no son válidas.');
    }
    const query = new URLSearchParams({
      longitude: String(longitude), latitude: String(latitude), country: 'cl',
      types: 'address,street,neighborhood,locality,place', access_token: this.token!,
    });
    const data = await this.mapboxGet<{ features?: MapboxFeature[] }>(`https://api.mapbox.com/search/geocode/v6/reverse?${query}`, 'Mapbox no pudo validar el punto seleccionado.');
    if (!data.features?.some((feature) => matchesGeographyScope(feature, scope))) {
      throw new BadRequestException(`El punto seleccionado debe estar dentro de ${geographyLabel(scope)}.`);
    }
    return [longitude, latitude];
  }

  private async optimizeDelivery(locations: Array<{ label: string; coordinates: [number, number] }>) {
    if (locations.length < 3) return locations;
    const coordinates = locations.map((location) => location.coordinates.join(',')).join(';');
    const query = new URLSearchParams({
      source: 'first', destination: 'any', roundtrip: 'true', geometries: 'geojson',
      access_token: this.token!,
    });
    const data = await this.mapboxGet<{ code?: string; waypoints?: Array<{ waypoint_index: number }> }>(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?${query}`, 'Mapbox no pudo ordenar las paradas.');
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
      alternatives: 'true', geometries: 'geojson', overview: 'full', steps: 'true',
      access_token: this.token!,
    });
    const data = await this.mapboxGet<{ code?: string; routes?: MapboxRoute[] }>(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${query}`, 'Mapbox no pudo calcular la ruta.');
    if (data.code !== 'Ok' || !data.routes?.length) throw new BadRequestException('Mapbox no encontró una ruta para esos puntos.');
    return data.routes;
  }

  private async mapboxGet<T>(url: string, errorMessage: string): Promise<T> {
    try {
      return (await axios.get<T>(url, { timeout: 15000 })).data;
    } catch {
      throw new ServiceUnavailableException(errorMessage);
    }
  }
}
