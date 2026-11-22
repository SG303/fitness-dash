import { daysBetween, isoWeek, addDays, weekStart } from './dates';
import type { RawData, RawEntry, RawSet, RawWeightData } from './types';

/** Training A and B alternate. */
export const PLAN_ROTATION = ['A', 'B'];
/** A week counts towards the streak with at least this many workouts. */
export const WEEKLY_TARGET = 2;
/** An exercise is stalled when its last this-many sessions brought no progress. */
export const STALL_SESSIONS = 4;
/** Number of weeks in the volume chart. */
export const VOLUME_WEEKS = 12;
/** The average duration covers this many of the latest workouts with a known duration. */
export const DURATION_WORKOUTS = 8;
/** Muscle map periods in weeks; the first is the default and the period of the teaser on the start page. */
export const MUSCLE_PERIODS = [4, 8, 12];
/** A set counts 1 for each main muscle of the exercise and this much for each secondary muscle. */
export const SECONDARY_WEIGHT = 0.5;
/** Colour steps of the muscle map: upper bounds in sets per week (exclusive). 0 sets is its own state. */
export const LOAD_STEPS = [2, 4, 6, 8];
/** Periods of the weight page in weeks, the current week included; null is the whole history. */
export const WEIGHT_PERIODS: (number | null)[] = [4, 12, 52, null];
/** Period the weight page opens with. */
export const WEIGHT_DEFAULT_PERIOD = 12;
/** Period of the weight teaser on the start page. */
export const WEIGHT_TEASER_WEEKS = 4;
/** Half-life of the weight trend in days: an older measurement weighs half as much after this many days. */
export const TREND_HALF_LIFE = 7;
/** A pause longer than this many days between measurements starts the trend anew. */
export const TREND_GAP_DAYS = 28;

export type MuscleId =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

/** Muscle groups of the muscle map: name and an optional explanation. */
export const MUSCLES: Record<MuscleId, { name: string; aka?: string }> = {
  chest: { name: 'Brust' },
  front_delts: { name: 'Vordere Schulter' },
  side_delts: { name: 'Seitliche Schulter' },
  rear_delts: { name: 'Hintere Schulter' },
  biceps: { name: 'Bizeps' },
  triceps: { name: 'Trizeps' },
  forearms: { name: 'Unterarme' },
  lats: { name: 'Latissimus', aka: 'Breiter Rückenmuskel' },
  upper_back: { name: 'Oberer Rücken', aka: 'Trapez und Rautenmuskeln' },
  lower_back: { name: 'Unterer Rücken', aka: 'Rückenstrecker' },
  abs: { name: 'Bauch', aka: 'Gerader Bauchmuskel' },
  obliques: { name: 'Seitlicher Bauch', aka: 'Schräge Bauchmuskeln' },
  glutes: { name: 'Gesäss' },
  quads: { name: 'Quadrizeps', aka: 'Oberschenkel vorne' },
  hamstrings: { name: 'Beinbeuger', aka: 'Oberschenkel hinten' },
  adductors: { name: 'Adduktoren', aka: 'Oberschenkel innen' },
  calves: { name: 'Waden' },
};

/**
 * Which muscles each exercise trains, by exercise_id. Add a line when Hermes logs a new
 * exercise; until then the muscle map names it as not assigned and leaves it out.
 */
export const EXERCISE_MUSCLES: Record<string, { main: MuscleId[]; secondary: MuscleId[] }> = {
  incline_chest_press:          { main: ['chest'],              secondary: ['front_delts', 'triceps'] },
  lat_pulldown:                 { main: ['lats'],               secondary: ['biceps', 'forearms', 'upper_back'] },
  leg_press:                    { main: ['quads', 'glutes'],    secondary: ['hamstrings', 'adductors'] },
  seated_leg_curl:              { main: ['hamstrings'],         secondary: ['calves'] },
  lateral_raise:                { main: ['side_delts'],         secondary: ['upper_back'] },
  shoulder_press_machine_p5:    { main: ['front_delts'],        secondary: ['side_delts', 'triceps'] },
  triceps_pushdown:             { main: ['triceps'],            secondary: [] },
  triceps_pushdown_rope:        { main: ['triceps'],            secondary: [] },
  core_rotation:                { main: ['obliques'],           secondary: ['abs'] },
  rotary_torso_matrix:          { main: ['obliques'],           secondary: ['abs'] },
  back_extension_matrix_bench:  { main: ['lower_back'],         secondary: ['glutes', 'hamstrings'] },
  calf_raise_technogym_plate_loaded: { main: ['calves'],        secondary: [] },
  seated_row:                   { main: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'] },
  rowing:                       { main: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'] },
  pec_fly:                      { main: ['chest'],              secondary: ['front_delts'] },
  butterfly:                    { main: ['chest'],              secondary: ['front_delts'] },
  leg_extension:                { main: ['quads'],              secondary: [] },
  hip_thrust:                   { main: ['glutes'],             secondary: ['hamstrings'] },
  reverse_fly:                  { main: ['rear_delts'],         secondary: ['upper_back'] },
  butterfly_reverse_horizontal: { main: ['rear_delts'],         secondary: ['upper_back'] },
  biceps_curl:                  { main: ['biceps'],             secondary: ['forearms'] },
  hammer_curl:                  { main: ['biceps', 'forearms'], secondary: [] },
  hammer_curl_rope:             { main: ['biceps', 'forearms'], secondary: [] },
  reverse_curl_fixed_barbell:   { main: ['forearms'],           secondary: ['biceps'] },
  deadhang:                     { main: ['forearms'],           secondary: ['lats'] },
};

/** Short display names for exercises whose name from Hermes is too long, by exercise_id. */
export const EXERCISE_NAMES: Record<string, string> = {
  rotary_torso_matrix: 'Rotary Torso',
  back_extension_matrix_bench: 'Hyperextension',
  calf_raise_technogym_plate_loaded: 'Wadenheben',
};

export type Unit = 'kg' | 's' | 'reps';

export interface Workout {
  id: string;
  date: string;
  plan: string | null;
  /** Reported performances, in plan order. */
  entries: RawEntry[];
  skipped: RawEntry[];
  /** Sum of weight × reps over all sets. */
  volume: number;
  /** Seconds from start to end as reported to Hermes; null when unknown. */
  duration: number | null;
}

export interface ExercisePoint {
  date: string;
  workoutId: string;
  /** Heaviest weight, longest hold or most reps, depending on the unit. */
  value: number;
  /** Tie-breaker at equal value: reps done at the heaviest weight, or total time/reps. */
  work: number;
  sets: string;
  record: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  plan: string | null;
  position: number | null;
  unit: Unit;
  points: ExercisePoint[];
  latest: ExercisePoint;
  /** latest.value − first value. */
  change: number;
  stalled: boolean;
  comment: string | null;
  /** The single kg value named in the comment, drawn as a goal line. */
  target: number | null;
}

export interface WeekVolume {
  start: string;
  week: number;
  volume: number;
  workouts: number;
}

export interface NextItem {
  id: string;
  name: string;
  exercise: Exercise | null;
  skippedLastTime: boolean;
  comment: string | null;
}

export interface NextWorkout {
  plan: string;
  /** Date of the last workout of this plan that the list is based on. */
  basedOn: string | null;
  items: NextItem[];
  /** Comments on exercises that were never logged, shown while the plan has no workout yet. */
  openComments: { id: string; name: string; text: string }[];
}

export interface Model {
  today: string;
  updatedAt: string;
  timeZone: string;
  workouts: Workout[];
  workoutsByDate: Map<string, Workout[]>;
  lastWorkout: Workout | null;
  daysSinceLast: number | null;
  monthWorkouts: number;
  weekStreak: number;
  weekVolume: number;
  /** Average seconds over the last DURATION_WORKOUTS workouts with a known duration. */
  averageDuration: number | null;
  /** Number of workouts the average is based on. */
  durationWorkouts: number;
  weeks: WeekVolume[];
  exercises: Exercise[];
  next: NextWorkout | null;
}

export interface MuscleExercise {
  id: string;
  name: string;
  /** Main muscle of the exercise; otherwise a secondary muscle. */
  main: boolean;
  /** Sets done in the period, not weighted. */
  sets: number;
}

export interface MuscleLoad {
  id: MuscleId;
  name: string;
  aka: string | null;
  /** Weighted sets in the period. */
  sets: number;
  perWeek: number;
  /** 0 = not trained, 1 … LOAD_STEPS.length + 1 = colour step. */
  step: number;
  /** Date of the last workout that trained the muscle, also before the period. */
  last: string | null;
  /** Exercises that trained the muscle in the period, main muscle first. */
  exercises: MuscleExercise[];
  /** Other logged exercises that train the muscle but were not done in the period. */
  others: string[];
}

export interface MuscleMap {
  weeks: number;
  start: string;
  end: string;
  /** Least trained first. */
  muscles: MuscleLoad[];
  /** Logged exercises without an entry in EXERCISE_MUSCLES. */
  unmapped: { id: string; name: string }[];
}

export class DataError extends Error {}

/** Checks the parts of the file the dashboard depends on. */
export function parseData(json: unknown): RawData {
  if (typeof json !== 'object' || json === null) {
    throw new DataError('Die Datei enthält kein JSON-Objekt.');
  }
  const data = json as Partial<RawData>;
  if (data.schema_version !== 1) {
    throw new DataError(
      `Unbekanntes Datenformat (schema_version ${String(data.schema_version)}). Das Dashboard kennt Version 1.`,
    );
  }
  if (!Array.isArray(data.performance_entries)) {
    throw new DataError('Der Datei fehlt die Liste performance_entries.');
  }
  return {
    schema_version: 1,
    updated_at: data.updated_at ?? '',
    timezone: data.timezone || 'Europe/Zurich',
    sessions: data.sessions ?? {},
    performance_entries: data.performance_entries,
    exercise_comments: data.exercise_comments ?? {},
  };
}

export function setVolume(sets: RawSet[]): number {
  return sets.reduce((sum, s) => sum + (s.reps && s.weight_kg ? s.reps * s.weight_kg : 0), 0);
}

function allSame<T>(values: T[]): boolean {
  return values.every((v) => v === values[0]);
}

/** "3 × 12", "2 × 12 pro Seite", "3 × 35 s" or "12, 10, 8". */
export function describeSets(sets: RawSet[]): string {
  if (sets.length === 0) return '';
  const sides = new Set(sets.map((s) => s.side).filter(Boolean));
  const perSide = sides.size > 1 ? sets.filter((s) => s.side === sets[0].side) : sets;
  const suffix = sides.size > 1 ? ' pro Seite' : '';
  if (perSide.every((s) => s.duration_seconds)) {
    const secs = perSide.map((s) => s.duration_seconds);
    return allSame(secs) ? `${perSide.length} × ${secs[0]} s${suffix}` : `${secs.join(', ')} s${suffix}`;
  }
  const reps = perSide.map((s) => s.reps ?? 0);
  return allSame(reps) ? `${perSide.length} × ${reps[0]}${suffix}` : `${reps.join(', ')}${suffix}`;
}

function unitOf(entries: RawEntry[]): Unit {
  const sets = entries.flatMap((e) => e.sets);
  if (sets.some((s) => s.weight_kg)) return 'kg';
  if (sets.some((s) => s.duration_seconds)) return 's';
  return 'reps';
}

function measure(sets: RawSet[], unit: Unit): { value: number; work: number } {
  if (unit === 'kg') {
    const value = Math.max(0, ...sets.map((s) => s.weight_kg ?? 0));
    const work = sets.filter((s) => s.weight_kg === value).reduce((n, s) => n + (s.reps ?? 0), 0);
    return { value, work };
  }
  const key = unit === 's' ? 'duration_seconds' : 'reps';
  const values = sets.map((s) => s[key] ?? 0);
  return { value: Math.max(0, ...values), work: values.reduce((a, b) => a + b, 0) };
}

function better(a: { value: number; work: number }, b: { value: number; work: number }): boolean {
  return a.value > b.value || (a.value === b.value && a.work > b.work);
}

/** The kg value of a comment like "Nächstes Mal 18 kg probieren.", if it names exactly one. */
export function targetFrom(comment: string | null): number | null {
  if (!comment) return null;
  const matches = [...comment.matchAll(/(\d+(?:[.,]\d+)?)\s*kg/gi)];
  return matches.length === 1 ? Number(matches[0][1].replace(',', '.')) : null;
}

function humanize(id: string): string {
  const text = id.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Display name: the short name from EXERCISE_NAMES, else Hermes' name, else the id. */
export function exerciseName(id: string, name?: string | null): string {
  return EXERCISE_NAMES[id] ?? name ?? humanize(id);
}

function byPosition(a: RawEntry, b: RawEntry): number {
  return (a.plan_position ?? 99) - (b.plan_position ?? 99);
}

function groupWorkouts(data: RawData): Workout[] {
  const groups = new Map<string, Workout>();
  const corrected = new Set(data.performance_entries.map((e) => e.corrects_entry_id).filter(Boolean));
  for (const entry of data.performance_entries) {
    if (corrected.has(entry.entry_id)) continue;
    const session = entry.session_id ? data.sessions[entry.session_id] : undefined;
    const date = session?.workout_date ?? entry.workout_date;
    if (!date) continue;
    const id = entry.session_id ?? `${date}-${entry.plan ?? ''}`;
    let workout = groups.get(id);
    if (!workout) {
      const seconds = session?.duration_seconds;
      const duration = typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
      workout = { id, date, plan: session?.plan ?? entry.plan, entries: [], skipped: [], volume: 0, duration };
      groups.set(id, workout);
    }
    if (entry.entry_type === 'reported_performance') {
      workout.entries.push(entry);
      workout.volume += setVolume(entry.sets);
    } else if (entry.entry_type === 'reported_skip') {
      workout.skipped.push(entry);
    }
  }
  for (const workout of groups.values()) {
    workout.entries.sort(byPosition);
    workout.skipped.sort(byPosition);
  }
  return [...groups.values()]
    .filter((w) => w.entries.length > 0 || data.sessions[w.id]?.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function buildExercises(workouts: Workout[], data: RawData): Exercise[] {
  const byId = new Map<string, { entry: RawEntry; workout: Workout }[]>();
  for (const workout of workouts) {
    for (const entry of workout.entries) {
      const list = byId.get(entry.exercise_id) ?? [];
      list.push({ entry, workout });
      byId.set(entry.exercise_id, list);
    }
  }

  const exercises: Exercise[] = [];
  for (const [id, list] of byId) {
    const unit = unitOf(list.map((l) => l.entry));
    const points: ExercisePoint[] = [];
    let best: { value: number; work: number } | null = null;
    for (const { entry, workout } of list) {
      const m = measure(entry.sets, unit);
      const record = best !== null && better(m, best);
      if (best === null || better(m, best)) best = m;
      points.push({ date: workout.date, workoutId: workout.id, ...m, sets: describeSets(entry.sets), record });
    }
    const latest = points[points.length - 1];
    // Stalled: none of the last STALL_SESSIONS sessions beat the session before them.
    const base = points[points.length - STALL_SESSIONS - 1];
    const stalled = base !== undefined && !points.slice(-STALL_SESSIONS).some((p) => better(p, base));
    const lastEntry = list[list.length - 1].entry;
    const comment = data.exercise_comments[id]?.text ?? null;
    exercises.push({
      id,
      name: exerciseName(id, lastEntry.exercise_name),
      plan: list[list.length - 1].workout.plan,
      position: lastEntry.plan_position,
      unit,
      points,
      latest,
      change: latest.value - points[0].value,
      stalled,
      comment,
      target: unit === 'kg' ? targetFrom(comment) : null,
    });
  }

  const planRank = (p: string | null) => (p === null ? 99 : PLAN_ROTATION.indexOf(p) + 1 || 50);
  return exercises.sort(
    (a, b) =>
      planRank(a.plan) - planRank(b.plan) ||
      (a.position ?? 99) - (b.position ?? 99) ||
      a.name.localeCompare(b.name, 'de'),
  );
}

function nextPlan(last: Workout | null): string | null {
  if (!last) return null;
  const index = last.plan ? PLAN_ROTATION.indexOf(last.plan) : -1;
  return PLAN_ROTATION[(index + 1) % PLAN_ROTATION.length];
}

function buildNext(workouts: Workout[], exercises: Exercise[], data: RawData): NextWorkout | null {
  const plan = nextPlan(workouts[workouts.length - 1] ?? null);
  if (!plan) return null;
  const known = new Map(exercises.map((e) => [e.id, e]));
  const template = workouts.findLast((w) => w.plan === plan);

  const items: NextItem[] = template
    ? [...template.entries, ...template.skipped].sort(byPosition).map((entry) => {
        const exercise = known.get(entry.exercise_id) ?? null;
        return {
          id: entry.exercise_id,
          name: exercise?.name ?? exerciseName(entry.exercise_id, entry.exercise_name),
          exercise,
          skippedLastTime: template.skipped.includes(entry),
          comment: data.exercise_comments[entry.exercise_id]?.text ?? null,
        };
      })
    : [];

  const openComments = template
    ? []
    : Object.values(data.exercise_comments)
        .filter((c) => c.text && !known.has(c.exercise_id))
        .map((c) => ({ id: c.exercise_id, name: exerciseName(c.exercise_id), text: c.text as string }));

  return { plan, basedOn: template?.date ?? null, items, openComments };
}

function countWeekStreak(workouts: Workout[], today: string): number {
  const perWeek = new Map<string, number>();
  for (const w of workouts) perWeek.set(weekStart(w.date), (perWeek.get(weekStart(w.date)) ?? 0) + 1);
  let week = weekStart(today);
  // The current week is still running: it only counts once the target is reached.
  if ((perWeek.get(week) ?? 0) < WEEKLY_TARGET) week = addDays(week, -7);
  let streak = 0;
  while ((perWeek.get(week) ?? 0) >= WEEKLY_TARGET) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

function buildWeeks(workouts: Workout[], today: string): WeekVolume[] {
  const current = weekStart(today);
  const weeks: WeekVolume[] = [];
  for (let i = VOLUME_WEEKS - 1; i >= 0; i -= 1) {
    const start = addDays(current, -7 * i);
    weeks.push({ start, week: isoWeek(start), volume: 0, workouts: 0 });
  }
  const index = new Map(weeks.map((w) => [w.start, w]));
  for (const workout of workouts) {
    const week = index.get(weekStart(workout.date));
    if (week) {
      week.volume += workout.volume;
      week.workouts += 1;
    }
  }
  return weeks;
}

function averageDuration(workouts: Workout[]): { average: number | null; count: number } {
  const durations = workouts
    .map((w) => w.duration)
    .filter((d) => d !== null)
    .slice(-DURATION_WORKOUTS);
  if (durations.length === 0) return { average: null, count: 0 };
  return { average: durations.reduce((a, b) => a + b, 0) / durations.length, count: durations.length };
}

export function buildModel(data: RawData, today: string): Model {
  const workouts = groupWorkouts(data).filter((w) => w.date <= today);
  const workoutsByDate = new Map<string, Workout[]>();
  for (const w of workouts) workoutsByDate.set(w.date, [...(workoutsByDate.get(w.date) ?? []), w]);
  const lastWorkout = workouts[workouts.length - 1] ?? null;
  const exercises = buildExercises(workouts, data);
  const weeks = buildWeeks(workouts, today);
  const duration = averageDuration(workouts);

  return {
    today,
    updatedAt: data.updated_at,
    timeZone: data.timezone,
    workouts,
    workoutsByDate,
    lastWorkout,
    daysSinceLast: lastWorkout ? daysBetween(lastWorkout.date, today) : null,
    monthWorkouts: workouts.filter((w) => w.date.startsWith(today.slice(0, 7))).length,
    weekStreak: countWeekStreak(workouts, today),
    weekVolume: weeks[weeks.length - 1].volume,
    averageDuration: duration.average,
    durationWorkouts: duration.count,
    weeks,
    exercises,
    next: buildNext(workouts, exercises, data),
  };
}

/** Sets of an entry; sets reported per side count once ("2 × 12 pro Seite" is two sets). */
export function setCount(sets: RawSet[]): number {
  const perSide = new Map<string, number>();
  for (const s of sets) perSide.set(s.side ?? '', (perSide.get(s.side ?? '') ?? 0) + 1);
  return Math.max(0, ...perSide.values());
}

export function loadStep(perWeek: number): number {
  if (perWeek <= 0) return 0;
  const i = LOAD_STEPS.findIndex((bound) => perWeek < bound);
  return i === -1 ? LOAD_STEPS.length + 1 : i + 1;
}

function trains(exerciseId: string, muscle: MuscleId): boolean {
  const muscles = EXERCISE_MUSCLES[exerciseId];
  return !!muscles && (muscles.main.includes(muscle) || muscles.secondary.includes(muscle));
}

/** Sets per week per muscle group over the last `weeks` × 7 days up to today. */
export function buildMuscleMap(model: Model, weeks: number): MuscleMap {
  const start = addDays(model.today, 1 - 7 * weeks);
  const names = new Map(model.exercises.map((e) => [e.id, e.name]));
  const loads = new Map<MuscleId, MuscleLoad & { byExercise: Map<string, MuscleExercise> }>();
  for (const [id, info] of Object.entries(MUSCLES) as [MuscleId, (typeof MUSCLES)[MuscleId]][]) {
    const empty = { sets: 0, perWeek: 0, step: 0, last: null, exercises: [], others: [], byExercise: new Map() };
    loads.set(id, { id, name: info.name, aka: info.aka ?? null, ...empty });
  }

  for (const workout of model.workouts) {
    for (const entry of workout.entries) {
      const muscles = EXERCISE_MUSCLES[entry.exercise_id];
      const count = setCount(entry.sets);
      if (!muscles || count === 0) continue;
      const roles = [
        ...muscles.main.map((m) => [m, true] as const),
        ...muscles.secondary.map((m) => [m, false] as const),
      ];
      for (const [muscle, main] of roles) {
        const load = loads.get(muscle)!;
        if (load.last === null || workout.date > load.last) load.last = workout.date;
        if (workout.date < start) continue;
        load.sets += main ? count : count * SECONDARY_WEIGHT;
        const id = entry.exercise_id;
        const exercise = load.byExercise.get(id) ?? { id, name: names.get(id) ?? id, main, sets: 0 };
        exercise.sets += count;
        load.byExercise.set(id, exercise);
      }
    }
  }

  const muscles: MuscleLoad[] = [...loads.values()].map(({ byExercise, ...load }) => {
    const perWeek = load.sets / weeks;
    const others = model.exercises.filter((e) => !byExercise.has(e.id) && trains(e.id, load.id)).map((e) => e.name);
    const exercises = [...byExercise.values()].sort((a, b) => Number(b.main) - Number(a.main) || b.sets - a.sets);
    return { ...load, perWeek, step: loadStep(perWeek), exercises, others };
  });
  // Least trained first; among equals the one trained longest ago (or never) leads.
  muscles.sort(
    (a, b) =>
      a.perWeek - b.perWeek ||
      (a.last ?? '').localeCompare(b.last ?? '') ||
      a.name.localeCompare(b.name, 'de'),
  );

  const unmapped = model.exercises.filter((e) => !EXERCISE_MUSCLES[e.id]).map((e) => ({ id: e.id, name: e.name }));
  return { weeks, start, end: model.today, muscles, unmapped };
}

/** The least trained muscle groups of the default period, for the start page. */
export function leastTrained(model: Model, count = 3): MuscleLoad[] {
  return buildMuscleMap(model, MUSCLE_PERIODS[0]).muscles.slice(0, count);
}

export interface WeightMeasurement {
  date: string;
  measuredAt: string;
  weight: number;
}

/** The first measurement of a day, with the smoothed trend up to that day. */
export interface WeightDay {
  date: string;
  weight: number;
  trend: number;
  /** First day after a long pause (or the very first): the trend starts anew here. */
  restart: boolean;
}

export interface WeightModel {
  today: string;
  updatedAt: string;
  timeZone: string;
  /** All measurements, oldest first. */
  measurements: WeightMeasurement[];
  days: WeightDay[];
}

export interface WeightWeek {
  start: string;
  week: number;
  /** Average of the daily values; null without a measurement. */
  average: number | null;
  measurements: number;
  /** Null without training data, or for weeks before the first logged workout. */
  workouts: number | null;
}

export interface WeightPeriod {
  weeks: number | null;
  /** Monday of the first week. */
  start: string;
  end: string;
  measurements: WeightMeasurement[];
  days: WeightDay[];
  /** Trend at the last minus the first measured day of the period; null with fewer than two days. */
  change: number | null;
  rows: WeightWeek[];
}

/** Checks the parts of gewichtsdaten.json the dashboard depends on. */
export function parseWeightData(json: unknown): RawWeightData {
  const data = (typeof json === 'object' && json !== null ? json : {}) as Partial<RawWeightData>;
  if (data.schema_version !== 1 || !Array.isArray(data.measurements)) {
    throw new DataError('gewichtsdaten.json hat ein unbekanntes Format.');
  }
  return {
    schema_version: 1,
    updated_at: data.updated_at ?? '',
    timezone: data.timezone || 'Europe/Zurich',
    measurements: data.measurements,
  };
}

export function buildWeight(data: RawWeightData, today: string): WeightModel {
  const measurements = data.measurements
    .filter((m) => m.date <= today && Number.isFinite(m.weight_kg) && m.weight_kg > 0)
    .map((m) => ({ date: m.date, measuredAt: m.measured_at, weight: m.weight_kg }))
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));

  const days: WeightDay[] = [];
  for (const m of measurements) {
    const prev = days[days.length - 1];
    if (prev?.date === m.date) continue;
    const gap = prev ? daysBetween(prev.date, m.date) : Infinity;
    const restart = gap > TREND_GAP_DAYS;
    // Exponential smoothing that respects the time between measurements, so sparse weeks are not overweighted.
    const trend = restart ? m.weight : prev.trend + (1 - 0.5 ** (gap / TREND_HALF_LIFE)) * (m.weight - prev.trend);
    days.push({ date: m.date, weight: m.weight, trend, restart });
  }

  return { today, updatedAt: data.updated_at, timeZone: data.timezone, measurements, days };
}

/**
 * The last `weeks` weeks up to today (whole weeks from Monday), or the whole
 * history for null. `workoutDates` has one entry per workout; null leaves the
 * workout counts out.
 */
export function weightPeriod(model: WeightModel, weeks: number | null, workoutDates: string[] | null): WeightPeriod {
  const current = weekStart(model.today);
  const first = model.days[0]?.date ?? model.today;
  const start = weeks === null ? weekStart(first < model.today ? first : model.today) : addDays(current, -7 * (weeks - 1));
  const days = model.days.filter((d) => d.date >= start);

  // Weeks before the first logged workout have no known count, which is not the same as none.
  const logStart = workoutDates?.length ? weekStart(workoutDates.reduce((a, b) => (a < b ? a : b))) : null;
  const rows: WeightWeek[] = [];
  for (let week = start; week <= current; week = addDays(week, 7)) {
    const end = addDays(week, 7);
    const inWeek = days.filter((d) => d.date >= week && d.date < end);
    rows.push({
      start: week,
      week: isoWeek(week),
      average: inWeek.length ? inWeek.reduce((sum, d) => sum + d.weight, 0) / inWeek.length : null,
      measurements: inWeek.length,
      workouts: workoutDates && logStart !== null && week >= logStart ? workoutDates.filter((d) => d >= week && d < end).length : null,
    });
  }

  return {
    weeks,
    start,
    end: model.today,
    measurements: model.measurements.filter((m) => m.date >= start),
    days,
    change: days.length >= 2 ? days[days.length - 1].trend - days[0].trend : null,
    rows,
  };
}
