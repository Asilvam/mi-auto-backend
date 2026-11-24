import { rankRoutes, scoreRoute } from './route-scoring';

describe('route scoring', () => {
  it('estimates fuel expense from distance and vehicle efficiency', () => {
    expect(scoreRoute(12000, 900, 12, 1500, 400)).toEqual({
      distanceMeters: 12000, durationSeconds: 900, fuelCostClp: 1500, tollsClp: 400, totalCostClp: 1900,
    });
  });

  it('selects cheapest and fastest independently', () => {
    const routes = [
      { id: 'short', ...scoreRoute(10000, 900, 10, 1000) },
      { id: 'fast', ...scoreRoute(14000, 600, 10, 1000) },
    ];
    expect(rankRoutes(routes).economical?.id).toBe('short');
    expect(rankRoutes(routes).fastest?.id).toBe('fast');
  });

  it('returns an empty selection when the routing provider has no result', () => {
    expect(rankRoutes([])).toEqual({ economical: null, fastest: null, routes: [] });
  });
});
