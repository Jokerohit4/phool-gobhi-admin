import { headers } from 'next/headers';
import { hasCrossOriginHeaders } from './csrf';

export async function hasInvalidActionOrigin(): Promise<boolean> {
  return hasCrossOriginHeaders(await headers());
}
