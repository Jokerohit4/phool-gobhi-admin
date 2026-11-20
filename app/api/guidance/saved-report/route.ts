import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';

export async function GET(request: Request) {
  await requireSession();
  const query = new URL(request.url).searchParams;
  const source = query.get('source'), id = query.get('reportId');
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (!['snapshot', 'document'].includes(source || '') || !id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Invalid report' }, { status: 400, headers });
  try {
    const result = await gatewayJson<{ data: { url: string } }>(`/api/health/guidance/admin/reports/${source}/${id}/link`);
    return new Response(null, { status: 302, headers: { ...headers, Location: result.data.url } });
  } catch { return Response.json({ error: 'Could not open this saved report' }, { status: 502, headers }); }
}
