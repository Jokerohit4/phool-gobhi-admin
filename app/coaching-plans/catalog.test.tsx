import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActionState } from '@/components/ui/ActionForm';
import { savePlansAction } from './actions';
import { CATALOG_PATH, type CatalogConfig } from './config';
import CoachingPlansPage from './page';
import type { V2Catalog } from './v2Config';

const { gatewayJson, renderState } = vi.hoisted(() => ({ gatewayJson: vi.fn(), renderState: { value: {} as ActionState } }));
vi.mock('@/lib/api', () => ({ gatewayJson }));
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn() }));
vi.mock('@/lib/actionOrigin', () => ({ hasInvalidActionOrigin: async () => false }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useActionState: () => [renderState.value, () => undefined, false],
}));

const local = { gym: 'unlimited', trainer: { sessions: 4, mode: 'in_person' }, nutritionist: null, nutritionGuidance: true } as const;
const catalog: V2Catalog = {
  schemaVersion: 2,
  offers: [{
    key: 'MED_30', family: 'medical', title: 'Medical guidance', description: 'Includes a trainer',
    amountPaise: 500000, durationDays: 30, enabled: true, regions: ['GURUGRAM', 'REST_INDIA'],
    refundPolicy: 'self_serve_72h', components: local,
    regionOverrides: { REST_INDIA: { components: { gym: null, trainer: { sessions: 4, mode: 'online' } } } },
  }],
  addons: [{
    key: 'ADDON_TRAINER', kind: 'trainer_session', unitPaise: 50000, requiresActivePlan: true,
    regions: ['GURUGRAM', 'REST_INDIA'], families: ['medical', 'wellness'],
    volumeTiers: [{ minQty: 4, discountPct: 10 }], volumeTierFamilies: ['medical'],
  }],
};

function catalogForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    version: '2', 'MED_30.title': 'Updated guidance', 'MED_30.description': 'Includes a trainer',
    'MED_30.price': '5000.29', 'MED_30.durationDays': '45', 'MED_30.GURUGRAM': 'on', 'MED_30.REST_INDIA': 'on',
    'MED_30.enabled': 'on', 'MED_30.refundPolicy': 'support', 'MED_30.base.gym': 'on',
    'MED_30.base.trainer': '5', 'MED_30.base.mode': 'in_person', 'MED_30.base.nutritionist': '1',
    'MED_30.base.nutritionGuidance': 'on', 'MED_30.override': 'on', 'MED_30.remote.trainer': '3',
    'MED_30.remote.mode': 'online', 'MED_30.remote.nutritionist': '0',
    'ADDON_TRAINER.price': '499.01', 'ADDON_TRAINER.tiers': '4, 10\n8, 15',
  })) form.set(key, value);
  return form;
}

const updatedAt = '2026-10-01T10:00:00.000Z';
const response = { data: { config: catalog, version: 2, updatedBy: 1, updatedAt, history: [{ version: 1, updatedBy: 1, createdAt: updatedAt }] } };
const loadPage = (region?: string) => CoachingPlansPage({ searchParams: Promise.resolve({ region }) });

beforeEach(() => {
  gatewayJson.mockReset().mockResolvedValue(response);
  renderState.value = {};
});

describe('coaching catalog editor', () => {
  it('publishes edited v2 offers and add-ons with exact paise and the loaded version', async () => {
    expect(await savePlansAction({}, catalogForm())).toMatchObject({ ok: true });
    const [url, request] = gatewayJson.mock.calls[1];
    expect(url).toBe(CATALOG_PATH);
    expect(request.method).toBe('PUT');
    expect(JSON.parse(request.body)).toEqual({
      expectedVersion: 2,
      config: {
        schemaVersion: 2,
        offers: [{
          ...catalog.offers[0], title: 'Updated guidance', amountPaise: 500029, durationDays: 45, refundPolicy: 'support',
          components: { ...local, trainer: { sessions: 5, mode: 'in_person' }, nutritionist: { sessions: 1 } },
          regionOverrides: { REST_INDIA: { components: {
            gym: null, trainer: { sessions: 3, mode: 'online' }, nutritionist: null, nutritionGuidance: false,
          } } },
        }],
        addons: [{
          ...catalog.addons[0], unitPaise: 49901, enabled: false,
          volumeTiers: [{ minQty: 4, discountPct: 10 }, { minQty: 8, discountPct: 15 }],
        }],
      },
    });
  });

  it('displays the backend validation message verbatim in the form', async () => {
    const message = 'Volume tier quantities must be unique';
    gatewayJson.mockResolvedValueOnce(response).mockRejectedValueOnce(new Error(message));
    renderState.value = await savePlansAction({}, catalogForm());
    expect(renderState.value).toEqual({ ok: false, message });
    const html = renderToStaticMarkup(await loadPage());
    expect(html).toContain(`>${message}</p>`);
    expect(html).toContain('Change history');
    expect(html).toContain('Version 1');
    expect(html).toContain('value="5000.00"');
  });

  it('reports both a stale form and a conflict during the write', async () => {
    const conflict = 'Another admin changed the plans. Reload before saving.';
    gatewayJson.mockResolvedValueOnce({ data: { ...response.data, version: 3 } });
    expect(await savePlansAction({}, catalogForm())).toEqual({ ok: false, conflict: true, message: conflict });
    expect(gatewayJson).toHaveBeenCalledTimes(1);
    gatewayJson.mockResolvedValueOnce(response).mockRejectedValueOnce(new Error(conflict));
    expect(await savePlansAction({}, catalogForm())).toEqual({ ok: false, conflict: true, message: conflict });
  });

  it('renders and saves the existing regional editor for an unversioned v1 catalog', async () => {
    const addon = { enabled: true, title: 'Trainer', description: 'In person', amountPaise: 149900, sessions: 2, validityDays: 30 };
    const legacy: CatalogConfig = { regions: {
      GURUGRAM: { label: 'Gurugram', plans: [], addon },
      REST_INDIA: { label: 'Rest of India', plans: [], addon: { ...addon, enabled: false } },
    } };
    gatewayJson.mockResolvedValue({ data: { ...response.data, config: legacy } });
    const html = renderToStaticMarkup(await loadPage('REST_INDIA'));
    expect(html).toContain('legacy regional plans');
    expect(html).toContain('name="region" value="REST_INDIA"');
    expect(html).toContain('Change history');
    const form = new FormData();
    for (const [key, value] of Object.entries({
      region: 'REST_INDIA', version: '2', label: 'Outside Gurugram', 'addon.title': 'Trainer',
      'addon.description': 'Online', 'addon.price': '1250.10', 'addon.sessions': '2', 'addon.validityDays': '30',
    })) form.set(key, value);
    expect(await savePlansAction({}, form)).toMatchObject({ ok: true });
    expect(JSON.parse(gatewayJson.mock.calls[2][1].body)).toMatchObject({
      expectedVersion: 2,
      config: { regions: { GURUGRAM: legacy.regions.GURUGRAM, REST_INDIA: { addon: { amountPaise: 125010 } } } },
    });
  });
});
