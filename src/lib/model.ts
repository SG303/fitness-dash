import { daysBetween, isoWeek, addDays, weekStart } from './dates';
import type { RawData, RawEntry, RawSet } from './types';

/** Training A and B alternate. */
export const PLAN_ROTATION = ['A', 'B'];
/** A week counts towards the streak with at least this many workouts. */
export const WEEKLY_TARGET = 2;
/** An exercise is stalled when its last this-many sessions brought no progress. */
export const STALL_SESSIONS = 4;
/** Number of weeks in the volume chart. */
export const VOLUME_WEEKS = 12;

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
  weeks: WeekVolume[];
  exercises: Exercise[];
  next: NextWorkout | null;
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

function byPosition(a: RawEntry, b: RawEntry): number {
  return (a.plan_position ?? 99) - (b.plan_position ?? 99);
}

function groupWorkouts(data: RawData): Workout[] {
  const groups = new Map<string, Workout>();
  for (const entry of data.performance_entries) {
    const session = entry.session_id ? data.sessions[entry.session_id] : undefined;
    const date = session?.workout_date ?? entry.workout_date;
    if (!date) continue;
    const id = entry.session_id ?? `${date}-${entry.plan ?? ''}`;
    let workout = groups.get(id);
    if (!workout) {
      workout = { id, date, plan: session?.plan ?? entry.plan, entries: [], skipped: [], volume: 0 };
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
      name: lastEntry.exercise_name ?? humanize(id),
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
          name: exercise?.name ?? entry.exercise_name ?? humanize(entry.exercise_id),
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
        .map((c) => ({ id: c.exercise_id, name: humanize(c.exercise_id), text: c.text as string }));

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

export function buildModel(data: RawData, today: string): Model {
  const workouts = groupWorkouts(data).filter((w) => w.date <= today);
  const workoutsByDate = new Map<string, Workout[]>();
  for (const w of workouts) workoutsByDate.set(w.date, [...(workoutsByDate.get(w.date) ?? []), w]);
  const lastWorkout = workouts[workouts.length - 1] ?? null;
  const exercises = buildExercises(workouts, data);
  const weeks = buildWeeks(workouts, today);

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
    weeks,
    exercises,
    next: buildNext(workouts, exercises, data),
  };
}
