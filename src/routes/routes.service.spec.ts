import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RoutesService } from './routes.service';

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe('RoutesService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reorders delivery stops, ranks route alternatives and estimates fuel cost', async () => {
    const config = { get: jest.fn(() => 'test-mapbox-token') } as unknown as ConfigService;
    const vehicles = { getPrimary: jest.fn().mockResolvedValue({ efficiencyKmPerLiter: 10, fuelPriceClp: 1000 }) } as unknown as VehiclesService;
    const service = new RoutesService(config, vehicles);
    const coordinates: Record<string, [number, number]> = {
      Start: [-71.53, -32.78], StopA: [-71.54, -32.79], StopB: [-71.55, -32.80], Destination: [-71.56, -32.81],
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/search/geocode/')) {
        const label = Object.keys(coordinates).find((key) => url.searchParams.get('q')?.startsWith(key))!;
        return response({ features: [{ geometry: { coordinates: coordinates[label] } }] });
      }
      if (url.pathname.includes('/optimized-trips/')) {
        return response({ code: 'Ok', waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }, { waypoint_index: 3 }] });
      }
      return response({ code: 'Ok', routes: [
        { distance: 12000, duration: 900, geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.56, -32.81]] } },
        { distance: 14000, duration: 600, geometry: { type: 'LineString', coordinates: [[-71.53, -32.78], [-71.56, -32.81]] } },
      ] });
    });

    const result = await service.plan(new Types.ObjectId(), { origin: 'Start', destination: 'Destination', stops: ['StopA', 'StopB'], tollsClp: 300 });

    expect(result.preferences.economical?.totalCostClp).toBe(1500);
    expect(result.preferences.fastest?.durationSeconds).toBe(600);
    expect(result.preferences.economical?.stopOrder).toEqual(['Start', 'StopB', 'StopA', 'Destination']);
    expect(result.tollsEstimated).toBe(false);
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
