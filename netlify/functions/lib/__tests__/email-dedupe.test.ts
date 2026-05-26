/**
 * Unit tests for the purchase-email idempotency layer.
 *
 * The dedupe helper relies on PostgreSQL's UNIQUE constraint on
 * `webhook_events(provider, event_id)` to make `INSERT … ON CONFLICT DO NOTHING
 * RETURNING id` atomic. We simulate that with a Map keyed by `(provider, event_id)`
 * so the helper's contract — "first caller wins, every subsequent caller loses" —
 * can be exercised without a real database.
 */

interface FakeRow {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payment_id: string;
}

const fakeTable = new Map<string, FakeRow>();
let fakeIdCounter = 0;

function tableKey(provider: string, eventId: string): string {
  return `${provider}::${eventId}`;
}

function resetTable(): void {
  fakeTable.clear();
  fakeIdCounter = 0;
}

jest.mock('../db', () => {
  const PSQL_INSERT_RE =
    /INSERT\s+INTO\s+webhook_events\s*\(provider,\s*event_id,\s*event_type,\s*payment_id\)/i;
  const PSQL_DELETE_RE = /DELETE\s+FROM\s+webhook_events/i;
  return {
    query: jest.fn(async (sql: string, params: any[]) => {
      if (PSQL_INSERT_RE.test(sql)) {
        const [provider, eventId, paymentId] = params;
        const key = tableKey(provider, eventId);
        if (fakeTable.has(key)) {
          // ON CONFLICT DO NOTHING RETURNING id → empty rows
          return { rows: [], rowCount: 0 };
        }
        const row: FakeRow = {
          id: `evt-${++fakeIdCounter}`,
          provider,
          event_id: eventId,
          event_type: 'purchase.email.sent',
          payment_id: paymentId,
        };
        fakeTable.set(key, row);
        return { rows: [{ id: row.id }], rowCount: 1 };
      }
      if (PSQL_DELETE_RE.test(sql)) {
        const [provider, eventId] = params;
        const key = tableKey(provider, eventId);
        const existed = fakeTable.delete(key);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }),
  };
});

import { reservePurchaseEmail, releasePurchaseEmailReservation } from '../email-dedupe';

describe('reservePurchaseEmail (idempotency lock)', () => {
  beforeEach(() => {
    resetTable();
  });

  it('grants the reservation to the first caller and rejects subsequent ones', async () => {
    const orderId = 'order-abc';
    const paymentId = 'pay-1';

    await expect(reservePurchaseEmail(orderId, paymentId)).resolves.toBe(true);
    await expect(reservePurchaseEmail(orderId, paymentId)).resolves.toBe(false);
    await expect(reservePurchaseEmail(orderId, paymentId)).resolves.toBe(false);
  });

  it('treats different orderIds as independent locks', async () => {
    await expect(reservePurchaseEmail('order-A', 'pay-1')).resolves.toBe(true);
    await expect(reservePurchaseEmail('order-B', 'pay-2')).resolves.toBe(true);
    await expect(reservePurchaseEmail('order-A', 'pay-1')).resolves.toBe(false);
  });

  it('ignores changes in paymentId for the same orderId (orderId is the unique key)', async () => {
    await expect(reservePurchaseEmail('order-X', 'pay-1')).resolves.toBe(true);
    // YooKassa "retry-after-internal-error" might attach a fresh paymentId-like value.
    // We deliberately keep the orderId as the dedupe key — the lock must still hold.
    await expect(reservePurchaseEmail('order-X', 'pay-2')).resolves.toBe(false);
  });

  it('stores `internal` as the webhook_events.provider (no clash with yookassa rows)', async () => {
    const orderId = 'order-prov-1';
    await reservePurchaseEmail(orderId, 'pay-1');
    const internalKey = tableKey('internal', `purchase-email:${orderId}`);
    const yookassaKey = tableKey('yookassa', `purchase-email:${orderId}`);
    expect(fakeTable.has(internalKey)).toBe(true);
    expect(fakeTable.has(yookassaKey)).toBe(false);
  });
});

describe('releasePurchaseEmailReservation (failure path)', () => {
  beforeEach(() => {
    resetTable();
  });

  it('removes the lock so a future retry can reserve again (Resend failure recovery)', async () => {
    const orderId = 'order-retry-1';
    await reservePurchaseEmail(orderId, 'pay-1');
    await releasePurchaseEmailReservation(orderId);
    await expect(reservePurchaseEmail(orderId, 'pay-2')).resolves.toBe(true);
  });

  it('is a no-op when there is no existing reservation', async () => {
    await expect(releasePurchaseEmailReservation('order-never-reserved')).resolves.toBeUndefined();
  });
});
