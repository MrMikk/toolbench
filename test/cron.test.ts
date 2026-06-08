import { describe as group, it, expect } from 'vitest';
import { describe, nextRuns, parseCron } from '../src/apps/cron/logic';

group('cron explainer', () => {
  it('parses steps, ranges and lists', () => {
    expect(parseCron('*/15 * * * *').minute.values).toEqual([0, 15, 30, 45]);
    expect(parseCron('0 9-11 * * *').hour.values).toEqual([9, 10, 11]);
    expect(parseCron('0 0 1,15 * *').dom.values).toEqual([1, 15]);
  });

  it('expands @-aliases', () => {
    expect(parseCron('@hourly').minute.values).toEqual([0]);
  });

  it('treats day-of-week 7 and 0 as Sunday', () => {
    expect(parseCron('0 0 * * 7').dow.values).toEqual([0]);
  });

  it('describes common expressions', () => {
    expect(describe(parseCron('* * * * *'))).toBe('Every minute');
    expect(describe(parseCron('0 9 * * *'))).toContain('At 09:00');
    expect(describe(parseCron('0 9 * * 1-5'))).toContain('Monday');
  });

  it('computes the next run times in UTC', () => {
    const from = new Date('2020-01-01T00:00:00Z');
    const runs = nextRuns(parseCron('*/15 * * * *'), from, 3).map((d) => d.toISOString());
    expect(runs).toEqual([
      '2020-01-01T00:15:00.000Z',
      '2020-01-01T00:30:00.000Z',
      '2020-01-01T00:45:00.000Z',
    ]);
  });

  it('honours day-of-week scheduling', () => {
    // 2020-01-01 is a Wednesday; the next Monday is the 6th.
    const runs = nextRuns(parseCron('0 0 * * 1'), new Date('2020-01-01T00:00:00Z'), 1);
    expect(runs[0].toISOString()).toBe('2020-01-06T00:00:00.000Z');
  });

  it('rejects malformed expressions', () => {
    expect(() => parseCron('* * *')).toThrow();
    expect(() => parseCron('60 * * * *')).toThrow();
  });
});
