export type ScoredRoute = {
  distanceMeters: number;
  durationSeconds: number;
  fuelCostClp: number;
  tollsClp: number;
  totalCostClp: number;
};

export function scoreRoute(distanceMeters: number, durationSeconds: number, efficiencyKmPerLiter: number, fuelPriceClp: number, tollsClp = 0, otherCostsClp = 0): ScoredRoute {
  const fuelCostClp = Math.round((distanceMeters / 1000 / efficiencyKmPerLiter) * fuelPriceClp);
  return { distanceMeters, durationSeconds, fuelCostClp, tollsClp, totalCostClp: fuelCostClp + tollsClp + otherCostsClp };
}

export function rankRoutes<T extends ScoredRoute>(routes: T[]) {
  if (!routes.length) return { economical: null, fastest: null, routes: [] as T[] };
  const economical = [...routes].sort((a, b) => a.totalCostClp - b.totalCostClp || a.distanceMeters - b.distanceMeters)[0];
  const fastest = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters)[0];
  return { economical, fastest, routes };
}
