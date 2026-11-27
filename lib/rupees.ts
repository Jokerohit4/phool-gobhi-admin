export function pricePaise(value: string, optional: false, maxPaise?: number): number;
export function pricePaise(value: string, optional: true, maxPaise?: number): number | null;
export function pricePaise(value: string, optional: boolean, maxPaise = 100000000): number | null {
  const raw = value.trim();
  if (raw === '' && optional) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Enter a price in rupees with at most two decimal places');
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > maxPaise) {
    throw new Error(`Enter a price from ₹0.01 to ₹${(maxPaise / 100).toLocaleString('en-IN')}`);
  }
  return amount;
}
