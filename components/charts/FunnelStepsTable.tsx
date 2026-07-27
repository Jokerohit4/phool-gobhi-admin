import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import type { StepWithDropoff } from '@/lib/analyticsLabels';

// Complements FunnelBarChart — the chart shows shape at a glance, this table
// answers "where exactly is the drop-off" without making the reader compute
// the division themselves.
export function FunnelStepsTable({ steps }: { steps: StepWithDropoff[] }) {
  return (
    <Table>
      <Thead>
        <Th>Step</Th>
        <Th>Count</Th>
        <Th>% of previous step</Th>
        <Th>% of top of funnel</Th>
      </Thead>
      <tbody>
        {steps.map((s) => (
          <Tr key={s.label}>
            <Td>{s.label}</Td>
            <Td className="tabular-nums">{s.value.toLocaleString()}</Td>
            <Td className="tabular-nums">{s.pctOfPrevious == null ? '—' : `${s.pctOfPrevious}%`}</Td>
            <Td className="tabular-nums">{s.pctOfTop == null ? '—' : `${s.pctOfTop}%`}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
