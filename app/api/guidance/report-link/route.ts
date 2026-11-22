import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { rejectCrossOrigin } from '@/lib/csrf';

export async function GET(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  await requireSession();
  const userId = Number(new URL(request.url).searchParams.get('userId'));
  if (!Number.isInteger(userId) || userId < 1) return Response.json({ error: 'Invalid customer' }, { status: 400 });
  try {
    const result = await gatewayJson<{ data: { url: string } }>(`/api/health/guidance/admin/${userId}/report-link`);
    return new Response(null, { status: 302, headers: { Location: result.data.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return Response.json({ error: 'Could not open the confirmed source report' }, { status: 502 }); }
}
