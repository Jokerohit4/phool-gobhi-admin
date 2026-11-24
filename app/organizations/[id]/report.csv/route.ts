import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { rejectCrossOrigin } from '@/lib/csrf';
import { parsePositiveId } from '@/lib/ids';
import { buildReportCsv, buildReportView, parsePeriod, reportFilename, type Dashboard } from '@/lib/orgDashboard';
import { formatDateIST } from '@/lib/dateFormat';

// CSV of the company report: aggregates only (see lib/orgDashboard.ts).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  await requireSession();
  const id = parsePositiveId((await params).id);
  if (id === null) return Response.json({ error: 'Invalid company' }, { status: 400 });
  const days = parsePeriod(new URL(request.url).searchParams.get('days') ?? undefined);
  try {
    const { data } = await gatewayJson<{ data: Dashboard }>(`/api/challenges/admin/orgs/${id}/dashboard?days=${days}`);
    // Never hand over a report built on data we could not read.
    if (!data.complete) return Response.json({ error: 'Activity could not be read just now. Try again in a minute.' }, { status: 503 });
    const view = buildReportView(data, formatDateIST);
    return new Response(buildReportCsv(view), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${reportFilename(view.company, view.period.endDay)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'Could not build the report' }, { status: 502 });
  }
}
