export type RouteCoordinates = [number, number];
export type RouteGeometry = { type: 'LineString'; coordinates: RouteCoordinates[] };
export type RouteLeg = { steps?: Array<{ geometry?: RouteGeometry }> };

function coordinatesFromLeg(leg: RouteLeg): RouteCoordinates[] {
  return (leg.steps ?? []).flatMap((step) => step.geometry?.coordinates ?? []);
}

function joinCoordinates(segments: RouteCoordinates[][]): RouteCoordinates[] {
  return segments.reduce<RouteCoordinates[]>((joined, segment) => {
    if (!segment.length) return joined;
    const startsAtPreviousEnd = joined.length > 0 && joined.at(-1)?.[0] === segment[0][0] && joined.at(-1)?.[1] === segment[0][1];
    return [...joined, ...segment.slice(startsAtPreviousEnd ? 1 : 0)];
  }, []);
}

export function splitRouteGeometry(geometry: RouteGeometry, legs?: RouteLeg[]) {
  if (!legs || legs.length < 2) return { outboundGeometry: geometry, returnGeometry: null };

  const legCoordinates = legs.map(coordinatesFromLeg);
  if (legCoordinates.some((coordinates) => coordinates.length < 2)) {
    return { outboundGeometry: geometry, returnGeometry: null };
  }

  const outboundCoordinates = joinCoordinates(legCoordinates.slice(0, -1));
  const returnCoordinates = legCoordinates.at(-1)!;
  if (outboundCoordinates.length < 2 || returnCoordinates.length < 2) {
    return { outboundGeometry: geometry, returnGeometry: null };
  }

  return {
    outboundGeometry: { type: 'LineString' as const, coordinates: outboundCoordinates },
    returnGeometry: { type: 'LineString' as const, coordinates: returnCoordinates },
  };
}
