export type GeographyScope = 'quintero' | 'valparaiso';

type PlaceFeature = {
  properties?: {
    full_address?: string;
    context?: {
      region?: { name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      district?: { name?: string };
    };
  };
};

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export function matchesGeographyScope(feature: PlaceFeature, scope: GeographyScope) {
  const properties = feature.properties;
  const context = properties?.context;
  const region = normalize(context?.region?.name);
  const address = normalize(properties?.full_address);

  if (scope === 'valparaiso') {
    return region === 'valparaiso' || region === 'region de valparaiso';
  }

  if (region && region !== 'valparaiso' && region !== 'region de valparaiso') return false;
  const municipalityNames = [context?.place?.name, context?.locality?.name, context?.district?.name]
    .map((name) => normalize(name));
  return municipalityNames.includes('quintero') || /(^|,\s*)quintero(\s*,|$)/.test(address);
}

export function geographyLabel(scope: GeographyScope) {
  return scope === 'quintero' ? 'Quintero' : 'la Región de Valparaíso';
}
