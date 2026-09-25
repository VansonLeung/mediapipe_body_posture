export type StudioLanguage = 'en' | 'zh-Hant';
export type ExerciseId = string;
export interface ExerciseCopy {
  name: string;
  subtitle: string;
  steps: string[];
  focus: string;
}
export interface ExerciseData {
  schemaVersion: 1;
  id: ExerciseId;
  category: string;
  publication: 'draft' | 'published' | 'archived';
  contentReview: 'pending' | 'reviewed';
  intendedAudience: string[];
  source: {
    kind: string;
    reference: string;
    status: 'provisional' | 'unvalidated' | 'reviewed';
  };
  requirements: {
    equipment: string[];
    position: 'standing' | 'floor' | 'inverted';
    jumping: boolean;
    camera: 'front' | 'side';
  };
  defaults: { target: number; unit: 'seconds' | 'reps' };
  analysisProfileId: string | null;
  presentation: { color: string; illustration: string | null };
  locales: Record<StudioLanguage, ExerciseCopy>;
}
export interface CollectionData {
  schemaVersion: 1;
  id: string;
  audience: string;
  locales: Record<StudioLanguage, { name: string }>;
  constraints: {
    equipmentFree: boolean;
    standingOnly: boolean;
    noJumping: boolean;
  };
  exerciseIds: ExerciseId[];
}
export interface RoutineTemplate {
  schemaVersion: 1;
  id: string;
  collectionId: string;
  locales: Record<StudioLanguage, { name: string }>;
  steps: { exercise: ExerciseId; target: number }[];
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(text);
const id = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v);
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid catalogue: ${message}`);
}
function localizedNames(
  v: unknown,
): v is Record<StudioLanguage, { name: string }> {
  return (
    object(v) && ['en', 'zh-Hant'].every((l) => object(v[l]) && text(v[l].name))
  );
}
export function parseExercise(data: unknown): ExerciseData {
  check(object(data), 'exercise must be an object');
  check(data.schemaVersion === 1 && id(data.id), 'exercise version / ID');
  const name = data.id;
  check(text(data.category), `${name}: category`);
  check(
    ['draft', 'published', 'archived'].includes(String(data.publication)),
    `${name}: publication`,
  );
  check(
    ['pending', 'reviewed'].includes(String(data.contentReview)),
    `${name}: content review`,
  );
  check(strings(data.intendedAudience), `${name}: audience`);
  check(
    object(data.source) &&
      text(data.source.kind) &&
      text(data.source.reference) &&
      ['provisional', 'unvalidated', 'reviewed'].includes(
        String(data.source.status),
      ),
    `${name}: provenance`,
  );
  const r = data.requirements;
  check(
    object(r) &&
      strings(r.equipment) &&
      ['standing', 'floor', 'inverted'].includes(String(r.position)) &&
      typeof r.jumping === 'boolean' &&
      ['front', 'side'].includes(String(r.camera)),
    `${name}: requirements`,
  );
  const d = data.defaults;
  check(
    object(d) &&
      Number.isInteger(d.target) &&
      Number(d.target) >= 0 &&
      Number(d.target) <= 300 &&
      ['seconds', 'reps'].includes(String(d.unit)),
    `${name}: target`,
  );
  check(
    data.analysisProfileId === null || id(data.analysisProfileId),
    `${name}: analysis reference`,
  );
  check(
    data.analysisProfileId === null ? d.target === 0 : Number(d.target) >= 1,
    `${name}: target must match review / automatic mode`,
  );
  const p = data.presentation;
  check(
    object(p) &&
      ['sage', 'sand', 'lavender', 'peach'].includes(String(p.color)) &&
      (p.illustration === null || id(p.illustration)),
    `${name}: presentation`,
  );
  check(localizedNames(data.locales), `${name}: bilingual names`);
  for (const language of ['en', 'zh-Hant']) {
    const copy = (data.locales as Record<string, unknown>)[language];
    check(
      object(copy) &&
        text(copy.subtitle) &&
        strings(copy.steps) &&
        copy.steps.length > 0 &&
        text(copy.focus),
      `${name}: ${language} content`,
    );
  }
  return data as unknown as ExerciseData;
}
export function parseCollection(data: unknown): CollectionData {
  check(
    object(data) &&
      data.schemaVersion === 1 &&
      id(data.id) &&
      text(data.audience) &&
      localizedNames(data.locales),
    'collection identity',
  );
  check(
    strings(data.exerciseIds) &&
      data.exerciseIds.length > 0 &&
      new Set(data.exerciseIds).size === data.exerciseIds.length,
    'collection exercise IDs',
  );
  const c = data.constraints;
  check(
    object(c) &&
      ['equipmentFree', 'standingOnly', 'noJumping'].every(
        (k) => typeof c[k] === 'boolean',
      ),
    'collection constraints',
  );
  return data as unknown as CollectionData;
}
export function collectionAllows(e: ExerciseData, c: CollectionData) {
  return (
    c.exerciseIds.includes(e.id) &&
    e.publication === 'published' &&
    e.intendedAudience.includes(c.audience) &&
    (!c.constraints.equipmentFree || e.requirements.equipment.length === 0) &&
    (!c.constraints.standingOnly || e.requirements.position === 'standing') &&
    (!c.constraints.noJumping || !e.requirements.jumping)
  );
}
export function parseTemplate(data: unknown): RoutineTemplate {
  check(
    object(data) &&
      data.schemaVersion === 1 &&
      id(data.id) &&
      id(data.collectionId) &&
      localizedNames(data.locales),
    'routine template identity',
  );
  check(
    Array.isArray(data.steps) &&
      data.steps.length > 0 &&
      data.steps.length <= 30 &&
      data.steps.every(
        (s) =>
          object(s) &&
          id(s.exercise) &&
          Number.isInteger(s.target) &&
          Number(s.target) >= 0 &&
          Number(s.target) <= 300,
      ),
    'routine template steps',
  );
  return data as unknown as RoutineTemplate;
}
