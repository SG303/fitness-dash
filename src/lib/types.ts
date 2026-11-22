/** Shape of trainingsdaten.json as written by Hermes (schema_version 1). Only the fields the dashboard reads. */

export interface RawSet {
  set_number?: number;
  side?: string | null;
  reps?: number | null;
  weight_kg?: number | null;
  duration_seconds?: number | null;
}

export interface RawEntry {
  entry_id: string;
  session_id: string | null;
  workout_date: string | null;
  plan: string | null;
  exercise_id: string;
  exercise_name: string | null;
  plan_position: number | null;
  /** "reported_performance" or "reported_skip". */
  entry_type: string;
  sets: RawSet[];
  /** entry_id of an earlier entry this one replaces; only the correction counts. */
  corrects_entry_id?: string | null;
}

export interface RawSession {
  session_id: string;
  plan: string | null;
  workout_date: string | null;
  status: string;
  /** Time from the start to the end report, breaks included; null while unknown. */
  duration_seconds?: number | null;
}

export interface RawComment {
  exercise_id: string;
  text: string | null;
  updated_at: string;
}

export interface RawData {
  schema_version: number;
  updated_at: string;
  timezone: string;
  sessions: Record<string, RawSession>;
  performance_entries: RawEntry[];
  exercise_comments: Record<string, RawComment>;
}

/** Shape of gewichtsdaten.json as written by the optional Withings service (schema_version 1). */
export interface RawWeightData {
  schema_version: number;
  /** Time of the last successful sync with Withings. */
  updated_at: string;
  timezone: string;
  /** Oldest first. */
  measurements: RawMeasurement[];
}

export interface RawMeasurement {
  measured_at: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  weight_kg: number;
}
