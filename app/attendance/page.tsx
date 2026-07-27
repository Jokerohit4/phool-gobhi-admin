import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';

interface AttendanceBucket {
  booked: number;
  scanned: number;
  manualOverride: number;
  noShow: number;
  verifiedAttendanceRate: number | null;
  completionRate: number | null;
}

interface AttendanceSummary {
  today: AttendanceBucket;
  weekly: AttendanceBucket;
  monthly: AttendanceBucket;
  yearly: AttendanceBucket;
}

interface ByGymRow {
  gymId: number;
  booked: number;
  scanned: number;
  manualOverride: number;
  noShow: number;
  verifiedAttendanceRate: number | null;
}

interface GymLite {
  id: number;
  name: string;
}

const PERIODS = ['today', 'weekly', 'monthly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];

function isPeriod(value: string | undefined): value is Period {
  return PERIODS.includes(value as Period);
}

function formatRate(rate: number | null) {
  return rate == null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

function gymLabel(gymId: number, gymsById: Map<number, string>) {
  return gymsById.get(gymId) || `Gym #${gymId}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSession();
  const { period: rawPeriod } = await searchParams;
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : 'monthly';

  const [{ data: summary }, { data: byGym }, { data: gyms }] = await Promise.all([
    gatewayJson<{ data: AttendanceSummary }>('/api/bookings/admin/attendance-summary'),
    gatewayJson<{ data: ByGymRow[] }>(`/api/bookings/admin/attendance-summary/by-gym?period=${period}`),
    gatewayJson<{ data: GymLite[] }>('/api/gyms/admin/all'),
  ]);

  const gymsById = new Map(gyms.map((g) => [g.id, g.name]));
  const bucket = summary[period];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Attendance" subtitle="Platform-wide check-in verification, by period." />

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/attendance?period=${p}`}
            className={`rounded px-3 py-1 text-sm capitalize ${
              p === period ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <div className="text-sm text-gray-500">Booked</div>
          <div className="text-2xl font-semibold">{bucket.booked}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Scanned</div>
          <div className="text-2xl font-semibold">{bucket.scanned}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Manual override</div>
          <div className="text-2xl font-semibold">{bucket.manualOverride}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">No-show</div>
          <div className="text-2xl font-semibold">{bucket.noShow}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Verified attendance rate</div>
          <div className="text-2xl font-semibold">{formatRate(bucket.verifiedAttendanceRate)}</div>
        </Card>
      </div>

      <PageHeader title="By gym" subtitle="Worst attendance first." />
      <Table>
        <Thead>
          <Th>Gym</Th>
          <Th>Booked</Th>
          <Th>Scanned</Th>
          <Th>Override</Th>
          <Th>No-show</Th>
          <Th>Rate</Th>
        </Thead>
        <tbody>
          {byGym.map((row) => (
            <Tr key={row.gymId}>
              <Td>
                <Link href={`/gyms/${row.gymId}`} className="underline">
                  {gymLabel(row.gymId, gymsById)}
                </Link>
              </Td>
              <Td>{row.booked}</Td>
              <Td>{row.scanned}</Td>
              <Td>{row.manualOverride}</Td>
              <Td>{row.noShow}</Td>
              <Td>{formatRate(row.verifiedAttendanceRate)}</Td>
            </Tr>
          ))}
          {byGym.length === 0 && <EmptyRow colSpan={6}>No bookings in this period.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
