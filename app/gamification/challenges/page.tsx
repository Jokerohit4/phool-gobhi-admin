import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { createDefinitionAction, createChallengeAction, setChallengeStatusAction, createSponsorAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';

interface ChallengeDefinition {
  id: number;
  key: string;
  type: string;
  category: string;
  title: string;
  defaultVerificationMethod: string;
}

interface ChallengeInstance {
  id: number;
  city: string;
  status: string;
  targetCount: number;
  rewardCoins: number;
  challengeDefinition: ChallengeDefinition;
  checkpointSpots: { id: number }[];
  _count: { enrollments: number };
}

interface Sponsor {
  id: number;
  type: string;
  name: string;
  status: string;
  contactInfo: string | null;
}

const CHALLENGE_TYPES = ['off_peak_hunter', 'city_gym_circuit', 'poi_checkin_tour', 'landmark_hunt', 'city_marathon_series', 'buddy_squad', 'gym_date_night'];
const CHALLENGE_CATEGORIES = ['gym_native', 'outside_gym_city', 'social'];
const VERIFICATION_METHODS = ['booking_attendance', 'qr_scan', 'gps_geofence', 'photo_review', 'manual_admin'];

export default async function ChallengesPage() {
  await requireSession();

  const { data: definitions } = await gatewayJson<{ data: ChallengeDefinition[] }>('/api/challenges/admin/challenges/definitions');
  const { data: challenges } = await gatewayJson<{ data: ChallengeInstance[] }>('/api/challenges/admin/challenges');
  const { data: sponsors } = await gatewayJson<{ data: Sponsor[] }>('/api/challenges/admin/sponsors');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Challenges"
          subtitle="Pilot launches with 2 free challenges (Off-Peak Hunter, gym_native; a city explorer quest, outside_gym_city). Gated behind the challenges flag in Settings."
        />
        <Table>
          <Thead>
            <Th>Title</Th>
            <Th>City</Th>
            <Th>Type</Th>
            <Th>Target</Th>
            <Th>Reward</Th>
            <Th>Enrollments</Th>
            <Th>Status</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {challenges.map((c) => (
              <Tr key={c.id}>
                <Td>{c.challengeDefinition.title}</Td>
                <Td>{c.city}</Td>
                <Td>{c.challengeDefinition.type}</Td>
                <Td>{c.targetCount}</Td>
                <Td>{c.rewardCoins} coins</Td>
                <Td>{c._count.enrollments}</Td>
                <Td>
                  <StatusBadge tone={c.status === 'active' ? 'active' : 'revoked'}>{c.status}</StatusBadge>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    {c.challengeDefinition.category === 'outside_gym_city' && (
                      <Link href={`/gamification/challenges/${c.id}/spots`} className="text-sm text-emerald-600 underline">
                        Spots ({c.checkpointSpots.length})
                      </Link>
                    )}
                    <ActionForm action={setChallengeStatusAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value={c.status === 'active' ? 'archived' : 'active'} />
                      <SubmitButton variant={c.status === 'active' ? 'danger' : 'secondary'} pendingText="Updating…">
                        {c.status === 'active' ? 'Archive' : 'Re-activate'}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </Td>
              </Tr>
            ))}
            {challenges.length === 0 && <EmptyRow colSpan={8}>No challenges yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Add a challenge (instance of a definition)" />
        <Card className="max-w-md">
          <ActionForm action={createChallengeAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="challengeDefinitionId">Definition</label>
            <select id="challengeDefinitionId" name="challengeDefinitionId" required className="rounded border px-3 py-2 text-sm">
              {definitions.map((d) => (
                <option key={d.id} value={d.id}>{d.title} ({d.type})</option>
              ))}
            </select>

            <label className="text-sm font-medium" htmlFor="city">City</label>
            <input id="city" name="city" required defaultValue="Gurugram" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="targetCount">Target count</label>
            <input id="targetCount" name="targetCount" type="number" min={1} required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="rewardCoins">Reward coins</label>
            <input id="rewardCoins" name="rewardCoins" type="number" min={0} required className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Creating…" className="w-fit">Add challenge</SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Challenge definitions" subtitle="Reusable templates a challenge instance is created from." />
        <Table>
          <Thead>
            <Th>Key</Th>
            <Th>Title</Th>
            <Th>Type</Th>
            <Th>Category</Th>
            <Th>Verification</Th>
          </Thead>
          <tbody>
            {definitions.map((d) => (
              <Tr key={d.id}>
                <Td className="font-mono text-xs">{d.key}</Td>
                <Td>{d.title}</Td>
                <Td>{d.type}</Td>
                <Td>{d.category}</Td>
                <Td>{d.defaultVerificationMethod}</Td>
              </Tr>
            ))}
            {definitions.length === 0 && <EmptyRow colSpan={5}>No definitions yet.</EmptyRow>}
          </tbody>
        </Table>
        <Card className="max-w-md">
          <ActionForm action={createDefinitionAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="key">Key</label>
            <input id="key" name="key" required placeholder="landmark_hunt_v1" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="type">Type</label>
            <select id="type" name="type" required className="rounded border px-3 py-2 text-sm">
              {CHALLENGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label className="text-sm font-medium" htmlFor="category">Category</label>
            <select id="category" name="category" required className="rounded border px-3 py-2 text-sm">
              {CHALLENGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="text-sm font-medium" htmlFor="title">Title</label>
            <input id="title" name="title" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="description">Description</label>
            <input id="description" name="description" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="defaultVerificationMethod">Verification method</label>
            <select id="defaultVerificationMethod" name="defaultVerificationMethod" required className="rounded border px-3 py-2 text-sm">
              {VERIFICATION_METHODS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiresGeofenceWithQr" />
              Requires GPS geofence + QR co-verification (anti-replay)
            </label>

            <SubmitButton pendingText="Creating…" className="w-fit">Add definition</SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Sponsors"
          subtitle="Not used by either pilot challenge yet — reserved for a subscriber-tier or sponsored challenge once one exists."
        />
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Contact</Th>
          </Thead>
          <tbody>
            {sponsors.map((s) => (
              <Tr key={s.id}>
                <Td>{s.name}</Td>
                <Td>{s.type}</Td>
                <Td><StatusBadge tone={s.status === 'active' ? 'active' : 'revoked'}>{s.status}</StatusBadge></Td>
                <Td>{s.contactInfo ?? '—'}</Td>
              </Tr>
            ))}
            {sponsors.length === 0 && <EmptyRow colSpan={4}>No sponsors yet.</EmptyRow>}
          </tbody>
        </Table>
        <Card className="max-w-md">
          <ActionForm action={createSponsorAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="name">Name</label>
            <input id="name" name="name" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="type">Type</label>
            <select id="type" name="type" required className="rounded border px-3 py-2 text-sm">
              <option value="gym">gym</option>
              <option value="brand">brand</option>
            </select>

            <label className="text-sm font-medium" htmlFor="contactInfo">Contact info</label>
            <input id="contactInfo" name="contactInfo" className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Adding…" className="w-fit">Add sponsor</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
