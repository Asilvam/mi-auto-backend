import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RoutesService } from './routes.service';

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe('RoutesService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('optimizes delivery stops before returning to the fixed base and estimates round-trip fuel', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({ efficiencyKmPerLiter: 10, fuelPriceClp: 1000 }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const coordinates: Record<string, [number, number]> = {
      Start: [-71.53, -32.78], StopA: [-71.54, -32.79], StopB: [-71.55, -32.80],
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        const label = Object.keys(coordinates).find((key) => url.searchParams.get('q')?.startsWith(key))!;
        return response({ features: [{ geometry: { coordinates: coordinates[label] } }] });
      }
      if (url.pathname.includes('/optimized-trips/')) {
        return response({ code: 'Ok', waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }] });
      }
      return response({ code: 'Ok', routes: [
        { distance: 12000, duration: 900, geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.56, -32.81]] } },
        { distance: 14000, duration: 600, geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.56, -32.81]] } },
      ] });
    });

    const result = await service.plan(new Types.ObjectId(), { type: 'delivery', origin: 'Start', destination: 'Start', stops: ['StopA', 'StopB'], tollsClp: 300 });

    expect(result.preferences.economical?.totalCostClp).toBe(1500);
    expect(result.preferences.fastest?.durationSeconds).toBe(600);
    expect(result.preferences.economical?.stopOrder).toEqual(['Start', 'StopB', 'StopA', 'Start']);
    expect(result.preferences.economical?.stopOrder[0]).toBe(result.preferences.economical?.stopOrder.at(-1));
    expect(result.optimizedStops).toBe(true);
    const optimizedRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/optimized-trips/'))!;
    expect(new URL(optimizedRequest[0] as string).searchParams.get('roundtrip')).toBe('true');
    expect(result.tollsEstimated).toBe(false);
  });

  it('plans a shared trip from base to destination and back without delivery stops', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({ efficiencyKmPerLiter: 10, fuelPriceClp: 1000 }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        const isDestination = url.searchParams.get('q')?.startsWith('Destino');
        return response({ features: [{ geometry: { coordinates: isDestination ? [-71.55, -32.80] : [-71.53, -32.78] } }] });
      }
      return response({ code: 'Ok', routes: [{ distance: 20000.4, duration: 1800.6, geometry: { type: 'LineString', coordinates: [] } }] });
    });

    const result = await service.plan(new Types.ObjectId(), { type: 'shared', origin: 'Base', destination: 'Destino', stops: ['debe ignorarse'] });

    expect(result.preferences.economical?.stopOrder).toEqual(['Base', 'Destino', 'Base']);
    expect(result.preferences.economical?.distanceMeters).toBe(20000);
    expect(result.preferences.economical?.durationSeconds).toBe(1801);
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
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        return response({ features: [{ geometry: { coordinates: [-71.54, -32.79] } }] });
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

  it('returns selectable address suggestions scoped to Quintero', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = {} as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response({ features: [
      { id: 'address.1', properties: { name: 'Plaza de Quintero', full_address: 'Plaza de Quintero, Quintero, Chile' }, geometry: { coordinates: [-71.53, -32.78] } },
      { id: 'missing.geometry', properties: { name: 'Invalid result' } },
    ] }));

    const result = await service.searchPlaces('Plaza');

    expect(fetchMock.mock.calls[0][0]).toContain('q=Plaza%2C+Quintero');
    expect(result).toEqual([{
      id: 'address.1',
      name: 'Plaza de Quintero',
      fullAddress: 'Plaza de Quintero, Quintero, Chile',
      coordinates: [-71.53, -32.78],
    }]);
  });
});
