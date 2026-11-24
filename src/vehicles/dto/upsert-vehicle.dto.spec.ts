import 'reflect-metadata';
import { validate } from 'class-validator';
import { UpsertVehicleDto } from './upsert-vehicle.dto';

const validVehicle = () => Object.assign(new UpsertVehicleDto(), {
  name: 'Mi auto', efficiencyKmPerLiter: 12.2, fuelPriceClp: 1400,
});

describe('UpsertVehicleDto base coordinates', () => {
  it('accepts a longitude and latitude pair', async () => {
    const dto = Object.assign(validVehicle(), { baseCoordinates: [-71.53, -32.78] });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an incomplete coordinate pair', async () => {
    const dto = Object.assign(validVehicle(), { baseCoordinates: [-71.53] });
    expect((await validate(dto)).some((error) => error.property === 'baseCoordinates')).toBe(true);
  });
});
