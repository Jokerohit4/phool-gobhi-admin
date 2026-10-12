'use client';

import useSWR, { useSWRInfinite } from 'swr';
import { gatewayJson } from '@/lib/api';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';

export default function UnclaimedGymsPage() {
  const { data: gyms, error, isLoading, mutate } = useSWR(
    '/api/gyms/unclaimed',
    async () => {
      const res = await gatewayJson('/api/gyms/unclaimed');
      return res.data;
    },
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  const [peopleCounts, setPeopleCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!gyms) return;
    const promises = gyms.map((gym) =>
      gatewayJson(`/api/bookings/admin/unclaimed-gyms/${gym.id}/people-count`)
    );
    Promise.allSettled(promises).then((results) => {
      const counts: Record<string, number | null> = {};
      results.forEach((result, i) => {
        const gymId = gyms[i].id;
        if (result.status === 'fulfilled') {
          const count = result.value?.data?.count;
          counts[gymId] = count !== null && count !== undefined ? count : null;
        } else {
          counts[gymId] = null;
        }
      });
      setPeopleCounts(counts);
    });
  }, [gyms]);

  if (isLoading) {
    return (
      <Card className="border-yellow-300 text-sm text-yellow-600 dark:border-yellow-800 dark:text-yellow-400">
        <p>Loading unclaimed gyms…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-300 text-sm text-red-700 dark:border-red-800 dark:text-red-400">
        <p>Failed to load unclaimed gyms: {error instanceof Error ? error.message : error}</p>
        <button
          onClick={() => mutate()}
          className="mt-2 rounded px-2 py-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Retry
        </button>
      </Card>
    );
  }

  if (!gyms || gyms.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Unclaimed gyms"
          subtitle="Gyms without a partner assignment — shows how many people already train there."
        />
        <EmptyRow colSpan={4}>
          No unclaimed gyms.
        </EmptyRow>
      </div>
    );
  }

  const rows = gyms.map((gym) => {
    const count = peopleCounts[gym.id];
    let countDisplay: string | null = null;

    if (count !== null && count !== undefined) {
      countDisplay = `${count} people already train here`;
    } else {
      // if count is null, display nothing (means under 5)
      // or failed request — show dash
      countDisplay = '—';
    }

    return (
      <Tr key={gym.id} className="border-b dark.border-gray-700">
        <Td>{gym.name}</Td>
        <Td>{gym.location || '—'}</Td>
        <Td>{gym.contactPhone || '—'}</Td>
        <Td>{countDisplay ?? '—'}</Td>
      </Tr>
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unclaimed gyms"
        subtitle="Gyms without a partner assignment — shows how many people already train there."
      />

      <Table>
        <Thead>
          <Th>Gym name</Th>
          <Th>Location</Th>
          <Th>Contact</Th>
          <Th>Attendance</Th>
        </Thead>
        <tbody>{rows}</tbody>
      </Table>

      <EmptyRow colSpan={4}>
        No unclaimed gyms.
      </EmptyRow>
    </div>
  );
}