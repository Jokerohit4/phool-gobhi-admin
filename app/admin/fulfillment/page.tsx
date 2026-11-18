import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
export default async function FulfillmentAlias() { await requireSession(); redirect('/fulfillment'); }
