import { describe, expect, it } from 'vitest';
import {
  activeCollection,
  availableExercises,
  definitions,
  getExercise,
  isAvailableExercise,
  validateDefinitions,
  validateCollection,
} from './index';
import { parseExercise } from './schema';
import { analyzers } from '../analysis/registry';
import { analysisProfiles } from '../analysis/profiles';
import {
  canStartRoutine,
  parseRoutines,
  unavailableSteps,
} from '../lib/routines';

describe('Primary 1–3 catalogue boundary', () => {
  it('offers only the curated standing, non-jumping, equipment-free movements', () => {
    expect(availableExercises.map((e) => e.id)).toEqual([
      'arms',
      'bend',
      'standing-balance',
      'overhead-reach',
      'elbow-bends',
      'knee-lifts',
      'side-step',
      'march-in-place',
      'high-knees',
      'shoulder-circles',
      'clasped-overhead-stretch',
      'clasped-forward-stretch',
      'standing-cat-cow',
      'hand-on-hip-side-stretch',
      'standing-twists',
      'hip-circles',
      'side-knee-lifts',
    ]);
    for (const e of availableExercises) {
      expect(e.data.requirements).toMatchObject({
        equipment: [],
        position: 'standing',
        jumping: false,
      });
      expect(e.data.publication).toBe('published');
      expect(e.data.intendedAudience).toContain('primary-1-3');
      expect(e.data.contentReview).toBe('pending');
    }
    expect(isAvailableExercise('bridge')).toBe(false);
    expect(isAvailableExercise('plank')).toBe(false);
    expect(isAvailableExercise('warrior')).toBe(false);
  });
  it('keeps canonical IDs for history and provisional source metadata', () => {
    expect(getExercise('bridge').name).toBe('Bridge / backbend');
    expect(getExercise('arch').id).not.toBe(getExercise('bridge').id);
    for (const e of definitions.filter(
      (e) => e.source.kind === 'ai-generated-reference',
    ))
      expect(e.source.status).toBe('provisional');
    expect(
      definitions.filter((e) => e.publication === 'draft').length,
    ).toBeGreaterThan(0);
  });
  it('rejects data that tries to enable unimplemented automatic checks', () => {
    const data = structuredClone(getExercise('arms').data);
    data.analysisProfileId = 'invented-detector';
    expect(() => validateDefinitions([data])).toThrow(/analysis profile/);
    data.analysisProfileId = 'plank';
    expect(() => validateDefinitions([data])).toThrow(/incompatible/);
    expect(Object.keys(analyzers).sort()).toEqual(
      Object.keys(analysisProfiles).sort(),
    );
    expect(
      Object.values(analysisProfiles).every(
        (p) => p.validatedAudiences.length === 0,
      ),
    ).toBe(true);
  });
  it('rejects duplicate IDs, missing bilingual instructions and missing artwork', () => {
    const data = structuredClone(getExercise('arms').data);
    expect(() => validateDefinitions([data, data])).toThrow(/Duplicate/);
    data.locales['zh-Hant'].steps = [];
    expect(() => parseExercise(data)).toThrow(/content/);
    const badAsset = structuredClone(getExercise('arms').data);
    badAsset.presentation.illustration = 'missing';
    expect(() => validateDefinitions([badAsset])).toThrow(/illustration/);
  });
  it('enforces collection constraints even when an ID is explicitly listed', () => {
    for (const mutate of [
      (e: (typeof definitions)[number]) => {
        e.requirements.jumping = true;
      },
      (e: (typeof definitions)[number]) => {
        e.requirements.position = 'floor';
      },
      (e: (typeof definitions)[number]) => {
        e.requirements.equipment = ['bench'];
      },
      (e: (typeof definitions)[number]) => {
        e.publication = 'draft';
      },
      (e: (typeof definitions)[number]) => {
        e.intendedAudience = [];
      },
    ]) {
      const all = structuredClone(definitions);
      mutate(all.find((e) => e.id === 'arms')!);
      expect(() => validateCollection(activeCollection, all)).toThrow(
        /does not satisfy/,
      );
    }
  });
  it('preserves saved combinations with unavailable or unknown steps but blocks practice', () => {
    const r = {
      id: 'old',
      name: 'Old combination',
      steps: [
        { exercise: 'arms', target: 4 },
        { exercise: 'bridge', target: 0 },
        { exercise: 'withdrawn-id', target: 2 },
      ],
    };
    const parsed = parseRoutines(JSON.stringify([r]));
    expect(parsed).toEqual([r]);
    expect(canStartRoutine(parsed[0])).toBe(false);
    expect(unavailableSteps(parsed[0]).map((s) => s.index)).toEqual([1, 2]);
    expect(
      canStartRoutine({ ...r, steps: [{ exercise: 'arms', target: 4 }] }),
    ).toBe(true);
  });
});
