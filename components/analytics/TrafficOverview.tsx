import Link from 'next/link';
import { gatewayJson } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/charts/StatTile';
import { SectionHeading } from '@/components/charts/SectionHeading';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { formatDateTimeIST } from '@/lib/dateFormat';
import { labelFor } from '@/lib/analyticsLabels';
import { dailyTrafficPoints, engagementDuration, TRAFFIC_PRODUCTS, type TrafficProduct, type TrafficPlatform, type TrafficReport } from '@/lib/traffic';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const number = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number, total: number) => total ? `${Math.round(value / total * 100)}%` : '—';
const productName = (app: string) => TRAFFIC_PRODUCTS[app as TrafficProduct] || app;
const platformName = (platform: string) => platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : platform === 'web' ? 'Web' : 'Unknown platform';

export function TrafficFilters({ days, product, platform }: { days: string; product: TrafficProduct; platform: TrafficPlatform }) {
  const mobile = product === 'customer' || product === 'partner';
  const linkStyle = (active: boolean) => `rounded-md px-3 py-2 text-sm ${active ? 'bg-emerald-600 font-medium text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`;
  return (
    <Card>
      <nav aria-label="Traffic product" className="flex flex-wrap gap-2">
        {(Object.entries(TRAFFIC_PRODUCTS) as [TrafficProduct, string][]).map(([key, label]) => (
          <Link key={key} href={`/analytics?view=traffic&days=${days}&product=${key}&platform=both`} aria-current={key === product ? 'page' : undefined} className={linkStyle(key === product)}>{label}</Link>
        ))}
      </nav>
      {mobile && (
        <nav aria-label="App platform" className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <span className="mr-2 text-sm text-gray-500">Platform</span>
          {(['both', 'android', 'ios'] as const).map(key => (
            <Link key={key} href={`/analytics?view=traffic&days=${days}&product=${product}&platform=${key}`} aria-current={key === platform ? 'page' : undefined} className={linkStyle(key === platform)}>{key === 'both' ? 'Both' : platformName(key)}</Link>
          ))}
        </nav>
      )}
    </Card>
  );
}

export async function TrafficOverview({ days, product, platform }: { days: string; product: TrafficProduct; platform: TrafficPlatform }) {
  let report: TrafficReport;
  try {
    const response = await gatewayJson<{ data: TrafficReport }>(`/api/bookings/admin/analytics/traffic?days=${days}&product=${product}&platform=${platform}`);
    report = response.data;
  } catch (error) {
    console.error('Traffic report unavailable', error);
    return <Card><div role="alert" className="text-sm">
      <p className="font-medium text-amber-700 dark:text-amber-400">Traffic data is unavailable</p>
      <p className="mt-1 text-gray-500">Try again to load activity and engagement for this selection.</p>
      <form action="/analytics" method="get" className="mt-3">
        <input type="hidden" name="view" value="traffic" /><input type="hidden" name="days" value={days} />
        <input type="hidden" name="product" value={product} /><input type="hidden" name="platform" value={platform} />
        <button className="text-emerald-700 underline dark:text-emerald-400">Try again</button>
      </form>
    </div></Card>;
  }
  const { summary, activeUsers } = report;
  const returning = report.frequency.filter(row => Number(row.label) > 1).reduce((sum, row) => sum + row.users, 0);
  const peak = [...report.heatmap].sort((a, b) => b.users - a.users || b.n - a.n)[0];
  const topScreen = report.screens.find(row => row.seconds > 0);
  const topAction = report.actions[0];

  return <>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
      <span>{TRAFFIC_PRODUCTS[product]}{product === 'customer' || product === 'partner' ? ` · ${platform === 'both' ? 'Android + iOS' : platformName(platform)}` : ''} · Charts: last {days} days</span>
      <span>As of {formatDateTimeIST(report.asOf)} IST</span>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile label="DAU" value={number(activeUsers.dau)} hint="Active identities · last 24 hours" />
      <StatTile label="WAU" value={number(activeUsers.wau)} hint="Active identities · last 7 days" />
      <StatTile label="MAU" value={number(activeUsers.mau)} hint="Active identities · last 30 days" />
      <StatTile label="DAU / MAU" value={percent(activeUsers.dau, activeUsers.mau)} hint="Share of monthly identities active in the last day" />
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Active identities in window" value={number(summary.users)} hint={`Last ${days} days`} />
      <StatTile label="Screen / page views" value={number(summary.views)} hint="Including repeat views" />
      <StatTile label="Sessions" value={number(summary.sessions)} hint="Tracked sessions, split after 30 min inactivity" />
      <StatTile label="Est. total engagement" value={engagementDuration(summary.sessions ? summary.seconds : null)} hint="Sum of eligible observed event gaps" />
      <StatTile label="Est. time per session" value={engagementDuration(summary.averageSecondsPerSession)} hint="Observed engagement / tracked sessions" />
      <StatTile label="Est. time per active identity" value={engagementDuration(summary.averageSecondsPerUser)} hint="Observed engagement / all active identities" />
    </div>
    <Card>
      <SectionHeading title="Engagement at a glance" subtitle={`Patterns within the selected ${days}-day window`} />
      {summary.users === 0 ? <p className="text-sm text-gray-500">No tracked activity for this selection yet.</p> : <div className="grid gap-4 text-sm sm:grid-cols-3">
        <div><p className="text-gray-500">Most observed screen time</p><p className="mt-1 break-words font-medium">{topScreen?.label || 'No observed screen time'}</p>{topScreen && <p className="text-xs text-gray-500">{productName(topScreen.app)} · {platformName(topScreen.platform)} · {engagementDuration(topScreen.seconds)} estimated</p>}</div>
        <div><p className="text-gray-500">Action with widest reach</p><p className="mt-1 break-words font-medium">{topAction ? labelFor(topAction.label) : 'No action observations'}</p>{topAction && <p className="text-xs text-gray-500">{productName(topAction.app)} · {platformName(topAction.platform)} · {number(topAction.users)} identities</p>}</div>
        <div><p className="text-gray-500">Return activity</p><p className="mt-1 font-medium">{percent(returning, summary.users)} active on 2+ days</p>{peak && <p className="text-xs text-gray-500">Busiest recurring slot: {WEEKDAYS[Number(peak.label)]} {peak.platform.padStart(2, '0')}:00–{String(Number(peak.platform) + 1).padStart(2, '0')}:00 IST</p>}</div>
      </div>}
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><SectionHeading title="Daily active identities" subtitle="Distinct identities per IST date; boundary dates are partial" /><TrendLineChart points={dailyTrafficPoints(report, 'users')} /></Card>
      <Card><SectionHeading title="Daily screen and page views" subtitle="All tracked screen_viewed events, including repeat visits" /><TrendLineChart points={dailyTrafficPoints(report, 'views')} /></Card>
    </div>
    <Card>
      <SectionHeading title="Product and platform breakdown" subtitle="Selected window; the All view includes unrecognised platform tags in a separate row" />
      <Table><Thead><Th>Product</Th><Th>Platform</Th><Th>Active identities</Th><Th>Views</Th><Th>Sessions</Th><Th>Est. time / session</Th></Thead><tbody>
        {report.breakdown.map(row => <Tr key={`${row.app}-${row.platform}`}><Td>{productName(row.app)}</Td><Td>{platformName(row.platform)}</Td><Td>{number(row.users)}</Td><Td>{number(row.views)}</Td><Td>{number(row.sessions)}</Td><Td>{engagementDuration(row.sessions ? row.seconds / row.sessions : null)}</Td></Tr>)}
        {report.breakdown.length === 0 && <EmptyRow colSpan={6}>No activity in this window.</EmptyRow>}
      </tbody></Table>
    </Card>
    <Card>
      <SectionHeading title="Most engaged screens and pages" subtitle="Top 30 by estimated observed time, then views. Time belongs to the last tracked screen before each eligible event gap." />
      <Table><Thead><Th>Screen / page</Th><Th>Product / platform</Th><Th>Identities</Th><Th>Views</Th><Th>Est. total time</Th><Th>Est. time / view</Th></Thead><tbody>
        {report.screens.map(row => <Tr key={`${row.app}-${row.platform}-${row.label}`}><Td><span className="break-all">{row.label}</span></Td><Td>{productName(row.app)} · {platformName(row.platform)}</Td><Td>{number(row.users)}</Td><Td>{number(row.views)}</Td><Td>{engagementDuration(row.seconds)}</Td><Td>{engagementDuration(row.views ? row.seconds / row.views : null)}</Td></Tr>)}
        {report.screens.length === 0 && <EmptyRow colSpan={6}>No screen views in this window.</EmptyRow>}
      </tbody></Table>
    </Card>
    <Card>
      <SectionHeading title="Most engaged actions" subtitle="Top 30 by distinct identity reach, then event count. Screen views, session starts, identify and diagnostic events are excluded." />
      <Table><Thead><Th>Action</Th><Th>Product / platform</Th><Th>Identities</Th><Th>Events</Th><Th>Events / identity</Th></Thead><tbody>
        {report.actions.map(row => <Tr key={`${row.app}-${row.platform}-${row.label}`}><Td><span className="break-all">{labelFor(row.label)}</span></Td><Td>{productName(row.app)} · {platformName(row.platform)}</Td><Td>{number(row.users)}</Td><Td>{number(row.n)}</Td><Td>{row.users ? (row.n / row.users).toFixed(1) : '—'}</Td></Tr>)}
        {report.actions.length === 0 && <EmptyRow colSpan={5}>No action events in this window.</EmptyRow>}
      </tbody></Table>
    </Card>
    <Card>
      <SectionHeading title="When people engage" subtitle="Distinct identities in each recurring weekday/hour slot, IST. Darker cells mean more identities; repeat weeks are deduplicated within each cell." />
      <TrafficHeatmap rows={report.heatmap} />
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><SectionHeading title="How often people return" subtitle="Distinct active IST dates per identity in this window" /><Table><Thead><Th>Active days</Th><Th>Identities</Th><Th>Share</Th></Thead><tbody>
        {report.frequency.map(row => <Tr key={row.label}><Td>{row.label} {row.label === '1' ? 'day' : 'days'}</Td><Td>{number(row.users)}</Td><Td>{percent(row.users, summary.users)}</Td></Tr>)}
        {report.frequency.length === 0 && <EmptyRow colSpan={3}>No activity in this window.</EmptyRow>}
      </tbody></Table></Card>
      <Card><SectionHeading title="Observed engagement per session" subtitle="Distribution of estimated active time, excluding gaps over 5 minutes" /><Table><Thead><Th>Observed time</Th><Th>Sessions</Th><Th>Share</Th></Thead><tbody>
        {['No observed time', 'Under 1 min', '1–5 min', '5–15 min', '15+ min'].map(label => {
          const count = report.sessionLengths.find(row => row.label === label)?.n || 0;
          return <Tr key={label}><Td>{label}</Td><Td>{number(count)}</Td><Td>{percent(count, summary.sessions)}</Td></Tr>;
        })}
      </tbody></Table></Card>
    </div>
    <Card>
      <SectionHeading title="How to read these metrics" />
      <div className="space-y-2 text-sm text-gray-500">
        <p>Active means at least one client screen, session or action event. Identity and diagnostic events do not count. Anonymous visitors are included; login transitions can create a second identity. All combines product-scoped identities, so the same person using two products can count twice. Platform rows can overlap for people using multiple devices.</p>
        <p>DAU, WAU and MAU always use rolling 24-hour, 7-day and 30-day windows ending at the report timestamp. Other metrics use the selected {days}-day window. App “Both” includes Android and iOS; missing platform tags appear only under All.</p>
        <p>Engagement time is an estimate from consecutive events in a tracked session: only gaps of up to 5 minutes count. Gaps over 30 minutes start another session. There is no inferred time after the final event, and this does not measure exact foreground time. Single-event sessions have no observed time.</p>
        <p>Session ID coverage: {percent(summary.sessionEvents, summary.n)} of {number(summary.n)} activity events. {number(summary.measured)} of {number(summary.sessions)} tracked sessions have a positive observed interval. Events without session IDs still contribute to active identities, views and action counts. Time per identity uses all active identities and may understate engagement when session coverage is incomplete.</p>
      </div>
    </Card>
  </>;
}

function TrafficHeatmap({ rows }: { rows: TrafficReport['heatmap'] }) {
  const cells = new Map(rows.map(row => [`${row.label}-${row.platform}`, row]));
  const max = Math.max(0, ...rows.map(row => row.users));
  const shades = ['bg-gray-100 dark:bg-gray-800', 'bg-emerald-100 dark:bg-emerald-950', 'bg-emerald-300 dark:bg-emerald-800', 'bg-emerald-500 dark:bg-emerald-600', 'bg-emerald-700 text-white dark:bg-emerald-400 dark:text-gray-950'];
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-separate border-spacing-1 text-center text-xs"><caption className="sr-only">Active identities by weekday and hour in India Standard Time</caption><thead><tr><th scope="col">IST</th>{Array.from({ length: 24 }, (_, hour) => <th scope="col" key={hour} className="font-normal text-gray-500">{hour.toString().padStart(2, '0')}</th>)}</tr></thead><tbody>
    {WEEKDAYS.map((day, weekday) => <tr key={day}><th scope="row" className="font-normal text-gray-500">{day}</th>{Array.from({ length: 24 }, (_, hour) => {
      const count = cells.get(`${weekday}-${hour}`)?.users || 0;
      const shade = count > 0 && max ? Math.max(1, Math.ceil(count / max * 4)) : 0;
      return <td key={hour} title={`${day} ${hour}:00 IST: ${number(count)} identities`} className={`h-8 rounded ${shades[shade]}`}>{count ? number(count) : '0'}</td>;
    })}</tr>)}
  </tbody></table><p className="mt-2 text-xs text-gray-500">0 to {number(max)} identities per slot · IST</p></div>;
}
