import { calculateTripCosts, DEFAULT_DELIVERY_RATES, isValidRateSchedule, resolveDeliveryRate } from './pricing-calculations';

describe('calculateTripCosts', () => {
  it('estimates fuel, tolls, extras and splits shared expenses among everyone', () => {
    expect(calculateTripCosts({
      type: 'shared', distanceMeters: 12000, efficiencyKmPerLiter: 12, fuelPriceClp: 1500,
      tollsClp: 1000, otherCostsClp: 500, participantCount: 4,
    })).toEqual({ fuelCostClp: 1500, tollsClp: 1000, otherCostsClp: 500, totalCostClp: 3000, costPerParticipantClp: 750, deliveryFeeClp: 0 });
  });

  it('keeps delivery income separate from vehicle expenses', () => {
    expect(calculateTripCosts({ type: 'delivery', distanceMeters: 5000, efficiencyKmPerLiter: 10, fuelPriceClp: 1400, deliveryFeeClp: 500 }))
      .toMatchObject({ fuelCostClp: 700, totalCostClp: 700, deliveryFeeClp: 500, costPerParticipantClp: 0 });
  });
});

describe('delivery rate schedule', () => {
  it('provides the requested free, $500 and $1000 time bands', () => {
    expect(isValidRateSchedule(DEFAULT_DELIVERY_RATES)).toBe(true);
    expect(resolveDeliveryRate(DEFAULT_DELIVERY_RATES, new Date('2026-11-24T11:00:00.000Z'))?.amountClp).toBe(500);
  });

  it('rejects overlapping or invalid time bands', () => {
    expect(isValidRateSchedule([
      { ...DEFAULT_DELIVERY_RATES[0], endTime: '09:00' },
      DEFAULT_DELIVERY_RATES[1],
    ])).toBe(false);
    expect(isValidRateSchedule([{ ...DEFAULT_DELIVERY_RATES[0], startTime: '08:99' }])).toBe(false);
  });
});
