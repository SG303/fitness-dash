import { describe, expect, it } from 'vitest';
import { isoWeek, nextMonthStart, todayIn, weekStart, weekday } from './dates';
import {
  DURATION_WORKOUTS,
  DataError,
  MUSCLES,
  buildModel,
  buildMuscleMap,
  describeSets,
  leastTrained,
  loadStep,
  parseData,
  targetFrom,
  type MuscleId,
} from './model';
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

  it('reads the duration per workout and averages the latest known ones', () => {
    const d = data([
      entry('2026-11-02', 'A', 'x', sets(1, 10, 10)),
      entry('2026-11-05', 'B', 'x', sets(1, 10, 10)),
      entry('2026-11-08', 'A', 'x', sets(1, 10, 10)),
      entry('2026-11-11', 'B', 'x', sets(1, 10, 10)),
    ]);
    d.sessions['gym-A-2026-11-02'].duration_seconds = 3000;
    d.sessions['gym-B-2026-11-05'].duration_seconds = 3600;
    // Unknown durations are null and never count as zero.
    d.sessions['gym-A-2026-11-08'].duration_seconds = null;
    const m = buildModel(d, '2026-11-11');
    expect(m.workouts.map((w) => w.duration)).toEqual([3000, 3600, null, null]);
    expect(m.averageDuration).toBe(3300);
    expect(m.durationWorkouts).toBe(2);
  });

  it('averages only the last DURATION_WORKOUTS known durations', () => {
    const entries = Array.from({ length: DURATION_WORKOUTS + 2 }, (_, i) =>
      entry(`2026-10-${String(i + 1).padStart(2, '0')}`, 'A', 'x', sets(1, 10, 10)),
    );
    const d = data(entries);
    Object.values(d.sessions).forEach((s, i) => (s.duration_seconds = i < 2 ? 600 : 3600));
    const m = buildModel(d, '2026-11-11');
    expect(m.averageDuration).toBe(3600);
    expect(m.durationWorkouts).toBe(DURATION_WORKOUTS);
  });

  it('has no average duration without any known duration', () => {
    const m = buildModel(data([entry('2026-11-11', 'A', 'x', sets(1, 10, 10))]), '2026-11-11');
    expect(m.averageDuration).toBeNull();
    expect(m.durationWorkouts).toBe(0);
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

describe('muscle map', () => {
  // 4 weeks up to 15 Nov are 19 Oct to 15 Nov.
  const today = '2026-11-15';
  const load = (m: ReturnType<typeof buildMuscleMap>, id: MuscleId) => m.muscles.find((l) => l.id === id)!;

  it('counts a set 1 for a main and 0.5 for a secondary muscle, per week', () => {
    const model = buildModel(
      data([entry('2026-11-10', 'A', 'incline_chest_press', sets(4, 10, 20), { exercise_name: 'Schrägbankdrücken' })]),
      today,
    );
    const map = buildMuscleMap(model, 4);
    expect(map).toMatchObject({ weeks: 4, start: '2026-10-19', end: today });
    expect(load(map, 'chest')).toMatchObject({ sets: 4, perWeek: 1, step: 1 });
    expect(load(map, 'front_delts')).toMatchObject({ sets: 2, perWeek: 0.5 });
    expect(load(map, 'front_delts').exercises).toEqual([
      { id: 'incline_chest_press', name: 'Schrägbankdrücken', main: false, sets: 4 },
    ]);
    expect(load(map, 'chest').exercises[0].main).toBe(true);
  });

  it('ignores skipped entries', () => {
    const model = buildModel(
      data([
        entry('2026-11-10', 'A', 'leg_extension', sets(3, 12, 30)),
        entry('2026-11-10', 'A', 'lat_pulldown', [], { entry_type: 'reported_skip' }),
      ]),
      today,
    );
    expect(load(buildMuscleMap(model, 4), 'lats')).toMatchObject({ sets: 0, step: 0, last: null, exercises: [] });
  });

  it('counts sets reported per side once', () => {
    const model = buildModel(
      data([
        entry('2026-11-10', 'A', 'core_rotation', [
          { side: 'left', reps: 12 },
          { side: 'left', reps: 12 },
          { side: 'right', reps: 12 },
          { side: 'right', reps: 10 },
        ]),
      ]),
      today,
    );
    expect(load(buildMuscleMap(model, 4), 'obliques').sets).toBe(2);
  });

  it('counts only the period, but remembers the last training before it', () => {
    const model = buildModel(
      data([
        entry('2026-10-18', 'A', 'leg_extension', sets(3, 12, 30)),
        entry('2026-10-19', 'B', 'seated_leg_curl', sets(3, 12, 30)),
        entry('2026-11-20', 'A', 'seated_leg_curl', sets(3, 12, 30)),
      ]),
      today,
    );
    const four = buildMuscleMap(model, 4);
    expect(load(four, 'quads')).toMatchObject({ sets: 0, step: 0, last: '2026-10-18', exercises: [] });
    expect(load(four, 'quads').others).toEqual(['leg_extension']);
    // The workout in the future is not part of the model.
    expect(load(four, 'hamstrings')).toMatchObject({ sets: 3, last: '2026-10-19' });

    const eight = buildMuscleMap(model, 8);
    expect(eight.start).toBe('2026-09-21');
    expect(load(eight, 'quads')).toMatchObject({ sets: 3, perWeek: 3 / 8 });
    expect(load(eight, 'quads').others).toEqual([]);
  });

  it('sorts least trained first, untrained by last training, then by name', () => {
    const model = buildModel(
      data([
        entry('2026-09-01', 'A', 'leg_extension', sets(3, 12, 30)),
        entry('2026-09-10', 'A', 'triceps_pushdown', sets(3, 12, 30)),
        entry('2026-11-10', 'A', 'hammer_curl', sets(8, 12, 10)),
        entry('2026-11-10', 'A', 'seated_leg_curl', sets(4, 12, 10)),
      ]),
      today,
    );
    const ids = buildMuscleMap(model, 4).muscles.map((m) => m.id);
    expect(ids).toHaveLength(Object.keys(MUSCLES).length);
    // Never trained (by name: Adduktoren, Bauch, Brust …), then quads (1 Sep) and triceps (10 Sep),
    // then by sets per week: calves 0.5, hamstrings 1, biceps and forearms 2 (by name).
    expect(ids.slice(0, 3)).toEqual(['adductors', 'abs', 'chest']);
    expect(ids.slice(-6)).toEqual(['quads', 'triceps', 'calves', 'hamstrings', 'biceps', 'forearms']);
  });

  it('names exercises that have no muscles assigned and leaves them out', () => {
    const model = buildModel(
      data([
        entry('2026-11-10', 'A', 'squat', sets(3, 10, 40), { exercise_name: 'Kniebeuge' }),
        entry('2026-11-10', 'A', 'leg_extension', sets(3, 12, 30)),
      ]),
      today,
    );
    const map = buildMuscleMap(model, 4);
    expect(map.unmapped).toEqual([{ id: 'squat', name: 'Kniebeuge' }]);
    expect(load(map, 'quads').sets).toBe(3);
    expect(load(map, 'glutes').sets).toBe(0);
  });

  it('picks the three least trained groups of the default period for the start page', () => {
    const model = buildModel(
      data([
        entry('2026-10-01', 'A', 'core_rotation', sets(3, 12)),
        entry('2026-11-10', 'A', 'leg_press', sets(3, 12, 50)),
      ]),
      today,
    );
    // Obliques and abs were trained before the period, so the never trained groups come first.
    expect(leastTrained(model).map((m) => m.name)).toEqual(['Bizeps', 'Brust', 'Hintere Schulter']);
    expect(leastTrained(model, 1)).toHaveLength(1);
  });

  it('maps sets per week to colour steps', () => {
    expect([0, 0.5, 1.99, 2, 4, 7.9, 8, 20].map(loadStep)).toEqual([0, 1, 1, 2, 3, 4, 5, 5]);
  });
});
