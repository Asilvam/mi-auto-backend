import { splitRouteGeometry, type RouteGeometry } from './route-segments';

const geometry: RouteGeometry = {
  type: 'LineString',
  coordinates: [[0, 0], [1, 1], [2, 2], [1, 1], [0, 0]],
};

describe('splitRouteGeometry', () => {
  it('separates outbound legs from the final return leg and joins shared endpoints once', () => {
    const result = splitRouteGeometry(geometry, [
      { steps: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [0.5, 0.5], [1, 1]] } }] },
      { steps: [{ geometry: { type: 'LineString', coordinates: [[1, 1], [1.5, 1.5], [2, 2]] } }] },
      { steps: [{ geometry: { type: 'LineString', coordinates: [[2, 2], [1, 1], [0, 0]] } }] },
    ]);

    expect(result.outboundGeometry.coordinates).toEqual([[0, 0], [0.5, 0.5], [1, 1], [1.5, 1.5], [2, 2]]);
    expect(result.returnGeometry?.coordinates).toEqual([[2, 2], [1, 1], [0, 0]]);
  });

  it('keeps the complete route visible when Mapbox does not return leg steps', () => {
    expect(splitRouteGeometry(geometry, [{}, {}])).toEqual({ outboundGeometry: geometry, returnGeometry: null });
    expect(splitRouteGeometry(geometry)).toEqual({ outboundGeometry: geometry, returnGeometry: null });
  });
});
