/**
 * Map a PhotoSpec's region (CN, US, ...) to the flag-icons code we
 * render in the spec catalog. Schengen visas don't map to a single
 * ISO country so we use the EU rosette; specs without a region get
 * `null` and the caller renders a colour-only chip.
 */

const REGION_TO_FLAG: Record<string, string> = {
  CN: 'cn',
  US: 'us',
  EU: 'eu',
  GB: 'gb',
  UK: 'gb',
  CA: 'ca',
  AU: 'au',
  NZ: 'nz',
  JP: 'jp',
  KR: 'kr',
  SG: 'sg',
  MY: 'my',
  VN: 'vn',
  TH: 'th',
  RU: 'ru',
  HK: 'hk',
  MO: 'mo',
  TW: 'tw',
}

export function flagCodeForRegion(region: string | undefined): string | null {
  if (!region) return null
  const code = REGION_TO_FLAG[region.toUpperCase()]
  return code ?? null
}
