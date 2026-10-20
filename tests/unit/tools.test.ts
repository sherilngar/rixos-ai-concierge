import { describe, expect, it } from 'vitest';
import { validateTool } from '../../src/domain/tools';
import { maskPii } from '../../src/domain/pii';

describe('tool input validation', () => {
  it('accepts a valid service request and applies defaults', () => {
    const r = validateTool('create_service_request', {
      department: 'housekeeping',
      category: 'Housekeeping',
      item: 'Extra towels',
      quantity: 2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.priority).toBe('normal');
  });
  it('rejects unknown departments and silly quantities', () => {
    expect(
      validateTool('create_service_request', { department: 'kitchen', category: 'x', item: 'y' })
        .ok,
    ).toBe(false);
    expect(
      validateTool('create_service_request', {
        department: 'housekeeping',
        category: 'x',
        item: 'y',
        quantity: 500,
      }).ok,
    ).toBe(false);
  });
  it('requires at least one dining item with a quantity', () => {
    expect(validateTool('create_dining_order', { items: [] }).ok).toBe(false);
    expect(
      validateTool('create_dining_order', { items: [{ name: 'Club sandwich', qty: 0 }] }).ok,
    ).toBe(false);
    const ok = validateTool('create_dining_order', {
      items: [{ name: 'Club sandwich', qty: 1 }],
      allergies: 'nuts',
    });
    expect(ok.ok).toBe(true);
  });
  it('validates reservation date, time and party size', () => {
    expect(
      validateTool('create_reservation', {
        outlet: 'Meat Point',
        date: 'today',
        time: '20:00',
        party_size: 2,
      }).ok,
    ).toBe(true);
    expect(
      validateTool('create_reservation', {
        outlet: 'Meat Point',
        date: 'someday',
        time: '20:00',
        party_size: 2,
      }).ok,
    ).toBe(false);
    expect(
      validateTool('create_reservation', {
        outlet: 'Meat Point',
        date: 'today',
        time: '25:00',
        party_size: 2,
      }).ok,
    ).toBe(false);
    expect(
      validateTool('create_reservation', {
        outlet: 'Meat Point',
        date: 'today',
        time: '20:00',
        party_size: 0,
      }).ok,
    ).toBe(false);
  });
  it('validates spa, transport, cancel and handover inputs', () => {
    expect(
      validateTool('create_spa_booking', {
        treatment: 'Signature massage',
        date: '2026-10-19',
        time: '16:00',
      }).ok,
    ).toBe(true);
    expect(
      validateTool('request_transport', {
        type: 'airport_departure',
        date: 'tomorrow',
        time: '09:00',
        pickup: 'Hotel',
        destination: 'Airport',
        passengers: 2,
      }).ok,
    ).toBe(true);
    expect(
      validateTool('request_transport', {
        type: 'helicopter',
        date: 'tomorrow',
        time: '09:00',
        pickup: 'Hotel',
        destination: 'Airport',
        passengers: 2,
      }).ok,
    ).toBe(false);
    expect(validateTool('cancel_request', { ticket_id: 'T-1001' }).ok).toBe(true);
    expect(validateTool('cancel_request', { ticket_id: '1; drop table' }).ok).toBe(false);
    expect(validateTool('handover_to_human', { reason: 'Complaint', urgency: 'high' }).ok).toBe(
      true,
    );
    expect(validateTool('get_my_requests', { extra: 1 }).ok).toBe(false);
  });
});

describe('personal data masking', () => {
  it('masks card numbers, passports and Emirates IDs', () => {
    expect(maskPii('my card is 4111-1111-1111-1111').text).toBe('my card is •••• 1111');
    expect(maskPii('passport number N1234567').found).toContain('passport');
    expect(maskPii('ID 784-1990-1234567-1').found).toEqual(['emirates_id']);
  });
  it('leaves room numbers, times and phone-like short numbers alone', () => {
    const r = maskPii('Room 1207, table at 20:00 for 4');
    expect(r.found).toEqual([]);
    expect(r.text).toBe('Room 1207, table at 20:00 for 4');
  });
});
