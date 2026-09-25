import categories from '../../catalog/categories.json';
import pilot from '../../catalog/collections/primary-1-3.json';
import { getAnalysisProfile } from '../analysis/profiles';
import { getIllustration } from './assets';
import {
  collectionAllows,
  parseCollection,
  parseExercise,
  parseTemplate,
} from './schema';
import type {
  CollectionData,
  ExerciseData,
  ExerciseId,
  StudioLanguage,
} from './schema';
export type { ExerciseId, StudioLanguage, ExerciseData } from './schema';
export type LegacyExerciseId = 'warrior' | 'tree' | 'arms' | 'bend';

export interface Exercise {
  id: ExerciseId;
  name: string;
  subtitle: string;
  category: string;
  support: 'automatic' | 'review';
  camera: 'front' | 'side';
  zh: { name: string; steps: string[]; focus: string };
  duration: string;
  target: number;
  unit: 'seconds' | 'reps';
  color: string;
  steps: string[];
  focus: string;
  data: ExerciseData;
}
export function validateDefinitions(raw: unknown[]): ExerciseData[] {
  const definitions = raw.map(parseExercise);
  const ids = new Set<string>();
  for (const e of definitions) {
    if (ids.has(e.id)) throw new Error(`Duplicate catalogue ID: ${e.id}`);
    ids.add(e.id);
    if (!Object.hasOwn(categories, e.category))
      throw new Error(`Unknown category: ${e.id}`);
    if (
      e.presentation.illustration &&
      !getIllustration(e.presentation.illustration)
    )
      throw new Error(`Missing illustration: ${e.id}`);
    if (e.analysisProfileId) {
      const profile = getAnalysisProfile(e.analysisProfileId);
      if (!profile || profile.unit !== e.defaults.unit)
        throw new Error(
          `Unknown or incompatible analysis profile: ${e.id} / ${e.analysisProfileId}`,
        );
    }
  }
  return definitions;
}
const files = import.meta.glob('../../catalog/exercises/*.json', {
  eager: true,
  import: 'default',
});
export const definitions = validateDefinitions(Object.values(files));
export const activeCollection = parseCollection(pilot);
export function validateCollection(c: CollectionData, all: ExerciseData[]) {
  for (const id of c.exerciseIds) {
    const e = all.find((e) => e.id === id);
    if (!e || !collectionAllows(e, c))
      throw new Error(`Exercise ${id} does not satisfy collection ${c.id}`);
  }
}
validateCollection(activeCollection, definitions);
function present(data: ExerciseData, language: StudioLanguage): Exercise {
  const copy = data.locales[language];
  const automatic = !!getAnalysisProfile(data.analysisProfileId);
  const { target, unit } = data.defaults;
  return {
    id: data.id,
    ...copy,
    category: data.category,
    support: automatic ? 'automatic' : 'review',
    camera: data.requirements.camera,
    zh: data.locales['zh-Hant'],
    target,
    unit,
    color: data.presentation.color,
    data,
    duration: automatic
      ? `${target} ${language === 'en' ? (unit === 'seconds' ? 'sec hold' : 'slow reps') : unit === 'seconds' ? '秒保持' : '次動作'}`
      : language === 'en'
        ? 'Teacher-reviewed attempts'
        : '由老師記錄次數',
  };
}
export const exercises = definitions.map((e) => present(e, 'en'));
const byId = new Map(exercises.map((e) => [e.id, e]));
export const findExercise = (id: string) => byId.get(id);
export function getExercise(id: ExerciseId): Exercise {
  const e = findExercise(id);
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}
export const availableExercises = activeCollection.exerciseIds.map(getExercise);
export const isAvailableExercise = (id: string) =>
  activeCollection.exerciseIds.includes(id) &&
  !!findExercise(id) &&
  collectionAllows(getExercise(id).data, activeCollection);
export const localizeExercise = (e: Exercise, language: StudioLanguage) => ({
  ...present(e.data, language),
  target: e.target,
});
export const categoryZh: Record<string, string> = Object.fromEntries(
  Object.entries(categories).map(([id, names]) => [id, names['zh-Hant']]),
);
const templateFiles = import.meta.glob('../../catalog/routines/*.json', {
  eager: true,
  import: 'default',
});
export const routineTemplates = Object.values(templateFiles).map(parseTemplate);
for (const template of routineTemplates) {
  if (
    template.collectionId !== activeCollection.id ||
    template.steps.some(
      (s) =>
        !isAvailableExercise(s.exercise) ||
        (getExercise(s.exercise).support === 'automatic'
          ? s.target < 1
          : s.target !== 0),
    )
  )
    throw new Error(`Unavailable step in routine template: ${template.id}`);
}
