import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Types } from 'mongoose';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RoutesService } from './routes.service';

const response = (body: unknown) => ({ status: 200, data: body }) as any;

describe('RoutesService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('optimizes delivery stops before returning to the fixed base and estimates round-trip fuel', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({ efficiencyKmPerLiter: 10, fuelPriceClp: 1000 }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const coordinates: Record<string, [number, number]> = {
      Start: [-71.53, -32.78], StopA: [-71.54, -32.79], StopB: [-71.55, -32.80],
    };
    const fetchMock = jest.spyOn(axios, 'get').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        const label = Object.keys(coordinates).find((key) => url.searchParams.get('q')?.startsWith(key))!;
        return response({ features: [{ properties: { context: { region: { name: 'Valparaíso' }, place: { name: 'Quintero' } } }, geometry: { coordinates: coordinates[label] } }] });
      }
      if (url.pathname.includes('/optimized-trips/')) {
        return response({ code: 'Ok', waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }] });
      }
      return response({ code: 'Ok', routes: [
        { distance: 12000, duration: 900, geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.56, -32.81]] }, legs: [
          { distance: 4000, duration: 300, steps: [{ geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.54, -32.79]] } }] },
          { distance: 4000, duration: 300, steps: [{ geometry: { type: 'LineString', coordinates: [[-71.54, -32.79], [-71.55, -32.80]] } }] },
          { distance: 4000, duration: 300, steps: [{ geometry: { type: 'LineString', coordinates: [[-71.55, -32.80], [-71.53, -32.78]] } }] },
        ] },
        { distance: 14000, duration: 600, geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.56, -32.81]] } },
      ] });
    });

    const result = await service.plan(new Types.ObjectId(), { type: 'delivery', origin: 'Start', destination: 'Start', stops: ['StopA', 'StopB'], tollsClp: 300 });

    expect(result.preferences.economical?.totalCostClp).toBe(1500);
    expect(result.preferences.fastest?.durationSeconds).toBe(600);
    expect(result.preferences.economical?.stopOrder).toEqual(['Start', 'StopB', 'StopA', 'Start']);
    expect(result.preferences.economical?.stopOrder[0]).toBe(result.preferences.economical?.stopOrder.at(-1));
    expect(result.preferences.economical?.outboundGeometry.coordinates).toEqual([[-71.53, -32.78], [-71.54, -32.79], [-71.55, -32.80]]);
    expect(result.preferences.economical?.returnGeometry?.coordinates).toEqual([[-71.55, -32.80], [-71.53, -32.78]]);
    expect(result.optimizedStops).toBe(true);
    const optimizedRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/optimized-trips/'))!;
    expect(new URL(optimizedRequest[0] as string).searchParams.get('roundtrip')).toBe('true');
    expect(new URL(fetchMock.mock.calls.at(-1)![0] as string).searchParams.get('steps')).toBe('true');
    expect(result.tollsEstimated).toBe(false);
  });

  it('plans a shared trip from base to destination and back without delivery stops', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({ efficiencyKmPerLiter: 10, fuelPriceClp: 1000 }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const fetchMock = jest.spyOn(axios, 'get').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        const isDestination = url.searchParams.get('q')?.startsWith('Destino');
        return response({ features: [{ properties: { context: { region: { name: 'Valparaíso' }, place: { name: 'Quintero' } } }, geometry: { coordinates: isDestination ? [-71.55, -32.80] : [-71.53, -32.78] } }] });
      }
      return response({ code: 'Ok', routes: [{ distance: 20000.4, duration: 1800.6, legs: [{ distance: 10000, duration: 800 }, { distance: 10000.4, duration: 1000.6 }], geometry: { type: 'LineString', coordinates: [] } }] });
    });

    const result = await service.plan(new Types.ObjectId(), { type: 'shared', origin: 'Base', destination: 'Destino', stops: ['debe ignorarse'] });

    expect(result.preferences.economical?.stopOrder).toEqual(['Base', 'Destino', 'Base']);
    expect(result.preferences.economical?.distanceMeters).toBe(20000);
    expect(result.preferences.economical?.durationSeconds).toBe(1801);
    expect(result.preferences.economical?.fareDistanceMeters).toBe(10000);
    expect(result.preferences.economical?.fareDurationSeconds).toBe(800);
    expect(Number.isInteger(result.preferences.economical?.distanceMeters)).toBe(true);
    expect(Number.isInteger(result.preferences.economical?.durationSeconds)).toBe(true);
    expect(result.optimizedStops).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/optimized-trips/'))).toBe(false);
    const directions = new URL(fetchMock.mock.calls.at(-1)![0] as string);
    expect(directions.pathname.split('/').at(-1)?.split(';')).toHaveLength(3);
  });

  it('uses the exact saved base coordinates for the route instead of re-geocoding the street name', async () => {
    const baseCoordinates: [number, number] = [-71.5338, -32.7837];
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({
      baseAddress: 'Luis Cousiño con Daneri, Quintero', baseCoordinates,
      efficiencyKmPerLiter: 10, fuelPriceClp: 1000,
    }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const fetchMock = jest.spyOn(axios, 'get').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        return response({ features: [{ properties: { context: { region: { name: 'Valparaíso' }, place: { name: 'Quintero' } } }, geometry: { coordinates: [-71.54, -32.79] } }] });
      }
      return response({ code: 'Ok', routes: [{ distance: 5000, duration: 600, geometry: { type: 'LineString', coordinates: [] } }] });
    });

    const result = await service.plan(new Types.ObjectId(), {
      type: 'shared', origin: 'Luis Cousiño con Daneri, Quintero', destination: 'Plaza de Quintero',
    });

    const searched = fetchMock.mock.calls.filter(([input]) => String(input).includes('/search/geocode/'));
    const directions = new URL(fetchMock.mock.calls.at(-1)![0] as string);
    const waypoints = directions.pathname.split('/').at(-1)!.split(';');
    expect(searched).toHaveLength(1);
    expect(waypoints[0]).toBe(baseCoordinates.join(','));
    expect(waypoints[2]).toBe(baseCoordinates.join(','));
    expect(result.preferences.economical?.stopOrder).toEqual([
      'Luis Cousiño con Daneri, Quintero', 'Plaza de Quintero', 'Luis Cousiño con Daneri, Quintero',
    ]);
  });

  it('routes to the exact selected map coordinates after validating the point is in the requested region', async () => {
    const baseCoordinates: [number, number] = [-71.5338, -32.7837];
    const destinationCoordinates: [number, number] = [-71.4012, -33.0213];
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({
      baseAddress: 'Base Quintero', baseCoordinates, efficiencyKmPerLiter: 10, fuelPriceClp: 1000,
    }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const fetchMock = jest.spyOn(axios, 'get').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/v6/reverse')) {
        return response({ features: [{ properties: { full_address: '23 Norte, Viña del Mar', context: { region: { name: 'Valparaíso' }, place: { name: 'Viña del Mar' } } } }] });
      }
      return response({ code: 'Ok', routes: [{ distance: 20000, duration: 1600, geometry: { type: 'LineString', coordinates: [] } }] });
    });

    await service.plan(new Types.ObjectId(), {
      type: 'shared', origin: 'Base Quintero', destination: '23 Norte, Viña del Mar', destinationCoordinates,
    });

    const directions = new URL(fetchMock.mock.calls.find(([input]) => String(input).includes('/directions/'))![0] as string);
    expect(directions.pathname.split('/').at(-1)?.split(';')).toEqual([
      baseCoordinates.join(','), destinationCoordinates.join(','), baseCoordinates.join(','),
    ]);
  });

  it('returns selectable address suggestions scoped to Quintero', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = {} as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const fetchMock = jest.spyOn(axios, 'get').mockResolvedValue(response({ features: [
      { id: 'address.1', properties: { name: 'Plaza de Quintero', full_address: 'Plaza de Quintero, Quintero, Valparaíso, Chile', context: { region: { name: 'Valparaíso' }, place: { name: 'Quintero' } } }, geometry: { coordinates: [-71.53, -32.78] } },
      { id: 'missing.geometry', properties: { name: 'Invalid result' } },
    ] }));

    const result = await service.searchPlaces('Plaza');

    expect(fetchMock.mock.calls[0][0]).toContain('q=Plaza%2C+Quintero%2C+Regi%C3%B3n+de+Valpara%C3%ADso');
    expect(result).toEqual([{
      id: 'address.1',
      name: 'Plaza de Quintero',
      fullAddress: 'Plaza de Quintero, Quintero, Valparaíso, Chile',
      coordinates: [-71.53, -32.78],
    }]);
  });

  it('searches shared destinations across the Valparaíso region and excludes other regions', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const service = new RoutesService(config, {} as VehiclesService);
    const fetchMock = jest.spyOn(axios, 'get').mockResolvedValue(response({ features: [
      { id: 'vina', properties: { name: 'Viña del Mar', full_address: 'Viña del Mar, Valparaíso, Chile', context: { region: { name: 'Valparaíso' }, place: { name: 'Viña del Mar' } } }, geometry: { coordinates: [-71.55, -33.02] } },
      { id: 'santiago', properties: { name: 'Santiago', full_address: 'Santiago, Región Metropolitana, Chile', context: { region: { name: 'Región Metropolitana' }, place: { name: 'Santiago' } } }, geometry: { coordinates: [-70.66, -33.45] } },
    ] }));

    const result = await service.searchPlaces('Viña', 'valparaiso');

    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('q')).toContain('Región de Valparaíso');
    expect(result.map((place) => place.id)).toEqual(['vina']);
  });

  it('does not return delivery suggestions from outside Quintero', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const service = new RoutesService(config, {} as VehiclesService);
    jest.spyOn(axios, 'get').mockResolvedValue(response({ features: [
      { id: 'concon', properties: { name: 'Concón', full_address: 'Concón, Valparaíso, Chile', context: { region: { name: 'Valparaíso' }, place: { name: 'Concón' } } }, geometry: { coordinates: [-71.52, -32.92] } },
      { id: 'quintero', properties: { name: 'Loncura', full_address: 'Loncura, Quintero, Valparaíso, Chile', context: { region: { name: 'Valparaíso' }, place: { name: 'Quintero' } } }, geometry: { coordinates: [-71.48, -32.78] } },
    ] }));

    expect((await service.searchPlaces('Loncura', 'quintero')).map((place) => place.id)).toEqual(['quintero']);
  });

  it('rejects a shared route destination geocoded outside the Valparaíso region', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({
      baseAddress: 'Base Quintero', baseCoordinates: [-71.53, -32.78], efficiencyKmPerLiter: 10, fuelPriceClp: 1000,
    }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    jest.spyOn(axios, 'get').mockResolvedValue(response({ features: [
      { properties: { full_address: 'Santiago, Región Metropolitana, Chile', context: { region: { name: 'Región Metropolitana' } } }, geometry: { coordinates: [-70.66, -33.45] } },
    ] }));

    await expect(service.plan(new Types.ObjectId(), {
      type: 'shared', origin: 'Base Quintero', destination: 'Santiago',
    })).rejects.toThrow('La ubicación debe estar dentro de la Región de Valparaíso.');
  });
});
