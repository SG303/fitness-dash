import { describe, expect, it } from 'vitest';
import { isoWeek, nextMonthStart, todayIn, weekStart, weekday } from './dates';
import { DataError, buildModel, describeSets, parseData, targetFrom } from './model';
import type { RawData, RawEntry, RawSet } from './types';

const sets = (n: number, reps: number, weight_kg?: number): RawSet[] =>
  Array.from({ length: n }, (_, i) => ({ set_number: i + 1, reps, weight_kg }));

let seq = 0;
function entry(date: string, plan: string, exercise_id: string, s: RawSet[], extra: Partial<RawEntry> = {}): RawEntry {
  seq += 1;
  return {
    entry_id: `e${seq}`,
    session_id: `gym-${plan}-${date}`,
    workout_date: date,
    plan,
    exercise_id,
    exercise_name: exercise_id,
    plan_position: 1,
    entry_type: 'reported_performance',
    sets: s,
    ...extra,
  };
}

function data(entries: RawEntry[], comments: Record<string, string> = {}): RawData {
  const sessions: RawData['sessions'] = {};
  for (const e of entries) {
    sessions[e.session_id!] = { session_id: e.session_id!, plan: e.plan, workout_date: e.workout_date, status: 'completed' };
  }
  return {
    schema_version: 1,
    updated_at: '2026-11-11T17:00:00+01:00',
    timezone: 'Europe/Zurich',
    sessions,
    performance_entries: entries,
    exercise_comments: Object.fromEntries(
      Object.entries(comments).map(([id, text]) => [id, { exercise_id: id, text, updated_at: '' }]),
    ),
  };
}

describe('dates', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-11-11')).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
    expect(weekday('2026-11-09')).toBe(0);
    expect(weekday('2026-11-15')).toBe(6);
  });

  it('computes ISO week numbers', () => {
    expect(isoWeek('2026-11-11')).toBe(46);
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(isoWeek('2026-01-01')).toBe(1);
  });

  it('takes today from the data time zone', () => {
    // 23:30 UTC is already the next day in Zurich.
    expect(todayIn('Europe/Zurich', new Date('2026-11-11T23:30:00Z'))).toBe('2026-11-12');
  });
});

describe('describeSets', () => {
  it('summarises equal sets', () => {
    expect(describeSets(sets(3, 12, 21.4))).toBe('3 × 12');
  });

  it('counts per side', () => {
    const s = [
      { side: 'left', reps: 12, weight_kg: 11 },
      { side: 'left', reps: 12, weight_kg: 11 },
      { side: 'right', reps: 12, weight_kg: 11 },
      { side: 'right', reps: 12, weight_kg: 11 },
    ];
    expect(describeSets(s)).toBe('2 × 12 pro Seite');
  });

  it('shows holds in seconds and lists uneven reps', () => {
    expect(describeSets([{ duration_seconds: 35 }, { duration_seconds: 35 }])).toBe('2 × 35 s');
    expect(describeSets([{ reps: 12 }, { reps: 10 }, { reps: 8 }])).toBe('12, 10, 8');
  });
});

describe('parseData', () => {
  it('rejects unknown schema versions', () => {
    expect(() => parseData({ schema_version: 2, performance_entries: [] })).toThrow(DataError);
    expect(() => parseData(null)).toThrow(DataError);
  });
});

describe('targetFrom', () => {
  it('reads a single kg value', () => {
    expect(targetFrom('Nächstes Mal 18 kg probieren.')).toBe(18);
    expect(targetFrom('25,3 kg halten')).toBe(25.3);
    expect(targetFrom('Nächstes Mal mehr Gewicht')).toBeNull();
    expect(targetFrom('von 20 kg auf 22 kg')).toBeNull();
  });
});

describe('buildModel', () => {
  it('sums volume as weight × reps, ignoring holds and skips', () => {
    const m = buildModel(
      data([
        entry('2026-11-11', 'A', 'leg_curl', sets(3, 12, 21.4)),
        entry('2026-11-11', 'A', 'leg_press', sets(3, 12, 49.5)),
        entry('2026-11-11', 'A', 'core_rotation', [
          { side: 'left', reps: 12, weight_kg: 11 },
          { side: 'right', reps: 12, weight_kg: 11 },
        ]),
        entry('2026-11-11', 'A', 'deadhang', [{ duration_seconds: 35 }]),
        entry('2026-11-11', 'A', 'lat_pulldown', [], { entry_type: 'reported_skip' }),
      ]),
      '2026-11-12',
    );
    expect(m.workouts).toHaveLength(1);
    expect(m.workouts[0].volume).toBeCloseTo(770.4 + 1782 + 264);
    expect(m.workouts[0].skipped.map((e) => e.exercise_id)).toEqual(['lat_pulldown']);
    expect(m.weekVolume).toBeCloseTo(2816.4);
    expect(m.daysSinceLast).toBe(1);
    expect(m.exercises.find((e) => e.id === 'deadhang')?.unit).toBe('s');
  });

  it('ignores entries without a date and workouts in the future', () => {
    const m = buildModel(
      data([
        entry('2026-11-11', 'A', 'x', sets(1, 10, 10), { workout_date: null, session_id: null }),
        entry('2026-11-20', 'A', 'x', sets(1, 10, 10)),
      ]),
      '2026-11-12',
    );
    expect(m.workouts).toHaveLength(0);
    expect(m.next).toBeNull();
  });

  it('marks records, change and stalls per exercise', () => {
    const m = buildModel(
      data([
        entry('2026-10-01', 'A', 'press', sets(3, 12, 20)),
        entry('2026-10-05', 'A', 'press', sets(3, 12, 22)),
        entry('2026-10-09', 'A', 'press', sets(3, 10, 22)),
        entry('2026-10-13', 'A', 'press', sets(3, 12, 22)),
        entry('2026-10-17', 'A', 'press', sets(3, 11, 22)),
        entry('2026-10-19', 'A', 'press', sets(3, 12, 22)),
      ]),
      '2026-10-20',
    );
    const press = m.exercises[0];
    expect(press.points.map((p) => p.record)).toEqual([false, true, false, false, false, false]);
    expect(press.change).toBe(2);
    expect(press.stalled).toBe(true);
  });

  it('needs more sessions than the stall window before calling a stall', () => {
    const m = buildModel(
      data(['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-13'].map((d) => entry(d, 'A', 'press', sets(3, 12, 20)))),
      '2026-10-20',
    );
    expect(m.exercises[0].stalled).toBe(false);
  });

  it('is not stalled when reps went up at the same weight', () => {
    const m = buildModel(
      data([
        entry('2026-10-01', 'A', 'press', sets(3, 10, 22)),
        entry('2026-10-05', 'A', 'press', sets(3, 10, 22)),
        entry('2026-10-09', 'A', 'press', sets(3, 10, 22)),
        entry('2026-10-11', 'A', 'press', sets(3, 10, 22)),
        entry('2026-10-13', 'A', 'press', sets(3, 12, 22)),
      ]),
      '2026-10-20',
    );
    expect(m.exercises[0].stalled).toBe(false);
    expect(m.exercises[0].latest.record).toBe(true);
  });

  it('counts weeks in a row with the weekly target', () => {
    const m = buildModel(
      data([
        // Week of 26 Oct: two workouts, week of 2 Nov: two, current week (9 Nov): one so far.
        entry('2026-10-26', 'A', 'x', sets(1, 10, 10)),
        entry('2026-10-29', 'B', 'x', sets(1, 10, 10)),
        entry('2026-11-02', 'A', 'x', sets(1, 10, 10)),
        entry('2026-11-05', 'B', 'x', sets(1, 10, 10)),
        entry('2026-11-10', 'A', 'x', sets(1, 10, 10)),
      ]),
      '2026-11-11',
    );
    expect(m.weekStreak).toBe(2);
    expect(m.monthWorkouts).toBe(3);
    expect(m.weeks).toHaveLength(12);
    expect(m.weeks.at(-1)).toMatchObject({ start: '2026-11-09', workouts: 1, volume: 100 });
  });

  it('suggests the other plan with its last values and comments', () => {
    const m = buildModel(
      data(
        [
          entry('2026-11-02', 'B', 'row', sets(3, 12, 32), { plan_position: 1 }),
          entry('2026-11-02', 'B', 'hang', [], { plan_position: 2, entry_type: 'reported_skip' }),
          entry('2026-11-05', 'A', 'press', sets(3, 12, 25)),
          entry('2026-11-08', 'A', 'row', sets(3, 12, 34)),
        ],
        { row: 'Nächstes Mal 36 kg' },
      ),
      '2026-11-11',
    );
    expect(m.next?.plan).toBe('B');
    expect(m.next?.basedOn).toBe('2026-11-02');
    expect(m.next?.items.map((i) => [i.id, i.exercise?.latest.value ?? null, i.skippedLastTime])).toEqual([
      ['row', 34, false],
      ['hang', null, true],
    ]);
    expect(m.next?.items[0].comment).toBe('Nächstes Mal 36 kg');
    expect(m.exercises.find((e) => e.id === 'row')?.target).toBe(36);
  });

  it('lists open comments while the next plan has no workout yet', () => {
    const m = buildModel(
      data([entry('2026-11-11', 'A', 'press', sets(3, 12, 25))], {
        press: 'Nächstes Mal 27 kg',
        butterfly_reverse: 'Nächstes Mal 26 kg probieren.',
      }),
      '2026-11-11',
    );
    expect(m.next).toMatchObject({ plan: 'B', basedOn: null, items: [] });
    expect(m.next?.openComments).toEqual([
      { id: 'butterfly_reverse', name: 'Butterfly reverse', text: 'Nächstes Mal 26 kg probieren.' },
    ]);
  });
});

describe('nextMonthStart', () => {
  it('rolls over the year', () => {
    expect(nextMonthStart('2026-11-11')).toBe('2026-12-01');
    expect(nextMonthStart('2026-12-31')).toBe('2027-01-01');
  });
});
