import { boundedInteger, pricePaise } from './config';

export const REGIONS = { GURUGRAM: 'Gurugram', REST_INDIA: 'Outside Gurugram' } as const;
type Region = keyof typeof REGIONS;
type Family = 'medical' | 'wellness';
export type Components = {
  gym: 'unlimited' | null;
  trainer: { sessions: number; mode: 'online' | 'in_person' } | null;
  nutritionist: { sessions: number } | null;
  nutritionGuidance: boolean;
};
export type Offer = {
  key: string;
  family: Family;
  title: string;
  description: string;
  amountPaise: number;
  durationDays: number;
  enabled: boolean;
  regions: Region[];
  refundPolicy: 'self_serve_72h' | 'support';
  components: Components;
  regionOverrides?: { REST_INDIA: { components: Partial<Components> } };
};
export type Addon = {
  key: string;
  kind: 'gym_session' | 'trainer_session' | 'nutritionist_session' | 'lab_test';
  unitPaise: number;
  enabled?: boolean;
  requiresActivePlan: true;
  regions: Region[];
  families: Family[];
  volumeTiers?: { minQty: number; discountPct: number }[];
  volumeTierFamilies?: Family[];
};
export type V2Catalog = { schemaVersion: 2; offers: Offer[]; addons: Addon[] };

export function editV2Catalog(current: V2Catalog, form: FormData): V2Catalog {
  const read = (name: string) => String(form.get(name) ?? '');
  const checked = (name: string) => form.get(name) === 'on';
  const integer = (name: string) => boundedInteger(read(name), name);
  function components(prefix: string): Components {
    const trainer = integer(`${prefix}.trainer`);
    const nutritionist = integer(`${prefix}.nutritionist`);
    return {
      gym: checked(`${prefix}.gym`) ? 'unlimited' : null,
      trainer: trainer ? { sessions: trainer, mode: read(`${prefix}.mode`) as NonNullable<Components['trainer']>['mode'] } : null,
      nutritionist: nutritionist ? { sessions: nutritionist } : null,
      nutritionGuidance: checked(`${prefix}.nutritionGuidance`),
    };
  }

  const offers = current.offers.map(offer => {
    const key = offer.key;
    const regions = (Object.keys(REGIONS) as Region[]).filter(region => checked(`${key}.${region}`));
    const edited: Offer = {
      ...offer,
      title: read(`${key}.title`),
      description: read(`${key}.description`),
      amountPaise: pricePaise(read(`${key}.price`), false),
      durationDays: integer(`${key}.durationDays`),
      enabled: checked(`${key}.enabled`),
      regions,
      refundPolicy: read(`${key}.refundPolicy`) as Offer['refundPolicy'],
      components: components(`${key}.base`),
    };
    if (regions.includes('REST_INDIA') && checked(key + '.override')) {
      edited.regionOverrides = { REST_INDIA: { components: components(key + '.remote') } };
    } else {
      delete edited.regionOverrides;
    }
    return edited;
  });
  const addons = current.addons.map(addon => {
    const tiers = read(`${addon.key}.tiers`).split('\n').map(line => line.trim()).filter(Boolean);
    const volumeTiers = tiers.map(line => {
      const match = /^(\d{1,9})\s*,\s*(\d{1,9})$/.exec(line);
      if (!match) throw new Error(`Enter one minimum quantity and discount percent per line for ${addon.key}`);
      return { minQty: Number(match[1]), discountPct: Number(match[2]) };
    });
    const edited: Addon = {
      ...addon,
      unitPaise: pricePaise(read(`${addon.key}.price`), false),
      enabled: checked(`${addon.key}.enabled`),
    };
    if (volumeTiers.length > 0) {
      edited.volumeTiers = volumeTiers;
    } else {
      delete edited.volumeTiers;
      delete edited.volumeTierFamilies;
    }
    return edited;
  });
  return { schemaVersion: 2, offers, addons };
}
