import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { InlineError } from '@/components/ui/InlineError';
import { FilterBar } from '@/components/ui/FilterBar';

type SavedReport = {
  id: number; userId: number; source: string; userName: string | null; phone: string | null;
  fileName: string; mimeType: string | null; status: string; createdAt: string;
  reportDate: string | null; detectedReportDate: string | null;
  proposedProfile: Record<string, unknown>; proposedMarkers: Record<string, unknown>;
};
type ReportPage = { reports: SavedReport[]; total: number; nextCursor: number | null; accountLookupUnavailable: boolean };

const input = 'rounded border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700';
const uploadedAt = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSession();
  const params = await searchParams;
  const source = params.source === 'document' ? 'document' : 'snapshot';
  const query = new URLSearchParams({ source });
  for (const key of ['userId', 'cursor', 'status']) {
    const value = params[key];
    if (typeof value === 'string' && value && (key !== 'status' || source === 'snapshot')) query.set(key, value);
  }
  let result: ReportPage = { reports: [], total: 0, nextCursor: null, accountLookupUnavailable: false };
  let error = '';
  try { result = (await gatewayJson<{ data: ReportPage }>(`/api/health/guidance/admin/reports?${query}`)).data; }
  catch (e) { error = e instanceof Error ? e.message : 'Could not load saved reports'; }
  const nextQuery = new URLSearchParams(query);
  if (result.nextCursor) nextQuery.set('cursor', String(result.nextCursor));

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Saved reports' }]} />
      <PageHeader title="Saved blood reports" subtitle="Every saved lab snapshot and uploaded lab report, including free users and files awaiting reading or confirmation." />

      <FilterBar className="items-center text-sm">
        <Link href="/reports?source=snapshot" className={source === 'snapshot' ? 'rounded bg-emerald-600 px-3 py-1 text-white' : 'rounded bg-gray-100 px-3 py-1 dark:bg-gray-800'}>Lab snapshots</Link>
        <Link href="/reports?source=document" className={source === 'document' ? 'rounded bg-emerald-600 px-3 py-1 text-white' : 'rounded bg-gray-100 px-3 py-1 dark:bg-gray-800'}>Saved lab documents</Link>
        <Link href="/fulfillment" className="ml-auto underline">Clinical review &amp; fulfillment</Link>
      </FilterBar>

      <Card>
        <FilterBar className="items-end">
          <form className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="source" value={source} />
            <label className="flex flex-col gap-1 text-sm">
              Customer ID
              <input name="userId" type="number" min="1" defaultValue={query.get('userId') || ''} className={input} />
            </label>
            {source === 'snapshot' && (
              <label className="flex flex-col gap-1 text-sm">
                Reading status
                <select name="status" defaultValue={query.get('status') || ''} className={input}>
                  <option value="">All statuses</option>
                  {['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            )}
            <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Filter reports</button>
            <Link href={`/reports?source=${source}`} className="px-2 py-2 text-sm underline">Reset</Link>
          </form>
        </FilterBar>
      </Card>

      {error && <InlineError title="Could not load saved reports" message={error} retryHref={`/reports?${query}`} />}
      {result.accountLookupUnavailable && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">Account names and phone numbers are temporarily unavailable. Reports remain listed by customer ID.</p>}
      <p className="text-sm text-gray-500">{result.total} saved reports in this view. Reading a file does not confirm its values or provide clinical clearance.</p>

      <Table>
        <Thead>
          <Th>Customer</Th>
          <Th>Report</Th>
          <Th>Saved at (IST)</Th>
          <Th>Report date</Th>
          <Th>Reading status</Th>
          <Th>Open file</Th>
        </Thead>
        <tbody>
          {result.reports.map((report) => (
            <Tr key={`${report.source}:${report.id}`}>
              <Td>
                <div>{report.userName || `Customer #${report.userId}`}</div>
                <div className="text-xs text-gray-500">#{report.userId}  {report.phone || 'Phone unavailable'}</div>
              </Td>
              <Td className="max-w-sm">
                <div className="font-medium">{report.fileName}</div>
                <div className="text-xs text-gray-500">#{report.id}  {report.mimeType || 'Document'}</div>
                {(Object.keys(report.proposedProfile).length > 0 || Object.keys(report.proposedMarkers).length > 0) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs underline">Proposed extracted values</summary>
                    <p className="my-2 text-xs text-amber-700 dark:text-amber-400">OCR proposals only. Check the original document and patient confirmation before using these values.</p>
                    <div className="space-y-1 text-xs">
                      {[...Object.entries(report.proposedProfile), ...Object.entries(report.proposedMarkers)].map(([key, value]) => (
                        <p key={key}>{key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                      ))}
                    </div>
                  </details>
                )}
              </Td>
              <Td className="whitespace-nowrap">{uploadedAt(report.createdAt)}</Td>
              <Td>{report.reportDate || (report.detectedReportDate ? `${report.detectedReportDate} (read from file)` : 'Not entered')}</Td>
              <Td>{report.status}</Td>
              <Td><a href={`/api/guidance/saved-report?source=${report.source}&reportId=${report.id}`} target="_blank" rel="noreferrer" className="text-emerald-700 underline dark:text-emerald-400">Open private report</a></Td>
            </Tr>
          ))}
          {!error && result.reports.length === 0 && <EmptyRow colSpan={6}>No saved reports match these filters.</EmptyRow>}
          {error && result.reports.length === 0 && <EmptyRow colSpan={6}>Could not load reports.</EmptyRow>}
        </tbody>
      </Table>

      <div className="flex gap-4 text-sm">
        {query.has('cursor') && <Link href={`/reports?${new URLSearchParams([...query].filter(([key]) => key !== 'cursor'))}`} className="underline">Newest reports</Link>}
        {result.nextCursor && <Link href={`/reports?${nextQuery}`} className="underline">Older reports ?</Link>}
      </div>
    </div>
  );
}
