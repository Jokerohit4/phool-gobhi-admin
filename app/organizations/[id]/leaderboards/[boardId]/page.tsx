import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson, GatewayError } from '@/lib/api';
import { parsePositiveId } from '@/lib/ids';
import { boardEndLabel, SCORING_LABEL, type OrgBoard, type Scoring } from '@/lib/orgApi';
import { formatDateIST } from '@/lib/dateFormat';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';

interface Standings {
  leaderboard: OrgBoard;
  entries: { rank: number; userId: number; name: string | null; team: string | null; score: number; activeDays: number; workoutDays: number; steps: number }[];
  teams: { rank: number; teamId: number; name: string; members: number; score: number }[];
  complete: boolean;
}

const scoreUnit = (s: Scoring) => (s === 'steps' ? 'steps' : 'days');

export default async function BoardStandingsPage({ params }: { params: Promise<{ id: string; boardId: string }> }) {
  await requireSession();
  const p = await params;
  const id = parsePositiveId(p.id);
  const boardId = parsePositiveId(p.boardId);
  if (id === null || boardId === null) notFound();

  let data: Standings;
  try {
    ({ data } = await gatewayJson<{ data: Standings }>(`/api/challenges/admin/orgs/${id}/leaderboards/${boardId}`));
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Companies', href: '/organizations' }, { label: 'Company', href: `/organizations/${id}` }, { label: 'Standings' }]} />
        <InlineError title="Could not load the standings" message={e instanceof Error ? e.message : 'Unknown error'} retryHref={`/organizations/${id}/leaderboards/${boardId}`} />
      </div>
    );
  }
  const b = data.leaderboard;

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Companies', href: '/organizations' }, { label: 'Company', href: `/organizations/${id}` }, { label: b.name }]} />
        <PageHeader
          title={b.name}
          subtitle={`${SCORING_LABEL[b.scoring]} · from ${formatDateIST(b.startsAt)} · ${boardEndLabel(b, formatDateIST)} · ${b.status}`}
        />
        {!data.complete && (
          <Card className="max-w-2xl text-sm text-amber-700">
            Some activity data could not be read just now, so scores may read low. Refresh in a minute.
          </Card>
        )}
        <p className="text-sm text-gray-500">
          Only members who have not opted out of leaderboards are ranked. People see colleagues as first name + last initial.
        </p>
      </Section>

      <Section title="People">
        <Table>
          <Thead>
            <Th>#</Th>
            <Th>Name</Th>
            <Th>Team</Th>
            <Th>Score ({scoreUnit(b.scoring)})</Th>
            <Th>Active days</Th>
            <Th>Workout days</Th>
            <Th>Steps</Th>
          </Thead>
          <tbody>
            {data.entries.map((e) => (
              <Tr key={e.userId}>
                <Td>{e.rank}</Td>
                <Td>{e.name ?? '-'}</Td>
                <Td>{e.team ?? '-'}</Td>
                <Td className="font-medium">{e.score.toLocaleString('en-IN')}</Td>
                <Td>{e.activeDays}</Td>
                <Td>{e.workoutDays}</Td>
                <Td>{e.steps.toLocaleString('en-IN')}</Td>
              </Tr>
            ))}
            {data.entries.length === 0 && <EmptyRow colSpan={7}>No ranked members yet.</EmptyRow>}
          </tbody>
        </Table>
      </Section>

      {b.showTeams && (
        <Section title="Teams">
          <Table>
            <Thead>
              <Th>#</Th>
              <Th>Team</Th>
              <Th>People</Th>
              <Th>Average score</Th>
            </Thead>
            <tbody>
              {data.teams.map((t) => (
                <Tr key={t.teamId}>
                  <Td>{t.rank}</Td>
                  <Td>{t.name}</Td>
                  <Td>{t.members}</Td>
                  <Td className="font-medium">{t.score.toLocaleString('en-IN')}</Td>
                </Tr>
              ))}
              {data.teams.length === 0 && <EmptyRow colSpan={4}>No teams with ranked members.</EmptyRow>}
            </tbody>
          </Table>
        </Section>
      )}
    </div>
  );
}
