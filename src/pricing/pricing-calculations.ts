export type DeliveryRateRule = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  amountClp: number;
};

export type TripCostInput = {
  distanceMeters: number;
  efficiencyKmPerLiter: number;
  fuelPriceClp: number;
  tollsClp?: number;
  otherCostsClp?: number;
  deliveryFeeClp?: number;
  participantCount?: number;
  type: 'shared' | 'delivery';
};

export const DEFAULT_DELIVERY_RATES: DeliveryRateRule[] = [
  { id: 'overnight', label: 'Mañana', startTime: '00:00', endTime: '08:00', amountClp: 0 },
  { id: 'daytime', label: 'Día', startTime: '08:00', endTime: '18:00', amountClp: 500 },
  { id: 'evening', label: 'Tarde', startTime: '18:00', endTime: '24:00', amountClp: 1000 },
];

export function calculateTripCosts(input: TripCostInput) {
  const distanceKm = input.distanceMeters / 1000;
  const fuelCostClp = Math.round((distanceKm / input.efficiencyKmPerLiter) * input.fuelPriceClp);
  const tollsClp = input.tollsClp ?? 0;
  const otherCostsClp = input.otherCostsClp ?? 0;
  const totalCostClp = fuelCostClp + tollsClp + otherCostsClp;
  const participantCount = Math.max(1, Math.floor(input.participantCount ?? 1));

  return {
    fuelCostClp,
    tollsClp,
    otherCostsClp,
    totalCostClp,
    costPerParticipantClp: input.type === 'shared' ? Math.ceil(totalCostClp / participantCount) : 0,
    deliveryFeeClp: input.type === 'delivery' ? input.deliveryFeeClp ?? 0 : 0,
  };
}

function parseTime(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isValidRateSchedule(rules: DeliveryRateRule[]) {
  if (!rules.length || rules.length > 12) return false;
  const ranges = rules.map((rule) => {
    const start = parseTime(rule.startTime);
    const end = rule.endTime === '24:00' ? 1440 : parseTime(rule.endTime);
    if (start === null || end === null || start >= end || !Number.isInteger(rule.amountClp) || rule.amountClp < 0) return null;
    return { start, end };
  });
  if (ranges.some((range) => range === null)) return false;
  const sorted = ranges.slice().sort((a, b) => a!.start - b!.start);
  return sorted.every((range, index) => index === 0 || sorted[index - 1]!.end <= range!.start);
}

export function getLocalMinute(date: Date, timeZone = 'America/Santiago') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function resolveDeliveryRate(rules: DeliveryRateRule[], date: Date, timeZone = 'America/Santiago') {
  const minute = getLocalMinute(date, timeZone);
  return rules.find((rule) => {
    const start = parseTime(rule.startTime);
    const end = rule.endTime === '24:00' ? 1440 : parseTime(rule.endTime);
    return start !== null && end !== null && minute >= start && minute < end;
  }) ?? null;
}
