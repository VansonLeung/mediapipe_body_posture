// Capabilities belong to implemented analysis, never to editable catalogue content.
export interface AnalysisProfile {
  status: 'experimental' | 'validated';
  validatedAudiences: readonly string[];
  unit: 'seconds' | 'reps';
}
export const analysisProfiles: Readonly<Record<string, AnalysisProfile>> =
  Object.fromEntries(
    [
      'warrior',
      'tree',
      'arms',
      'bend',
      'standing-balance',
      'one-leg-balance',
      'tuck',
      'pike',
      'straddle',
      'plank',
      'overhead-reach',
      'elbow-bends',
    ].map((id) => [
      id,
      {
        status: 'experimental',
        validatedAudiences: [],
        unit: ['arms', 'bend', 'overhead-reach', 'elbow-bends'].includes(id)
          ? 'reps'
          : 'seconds',
      },
    ]),
  );
export const getAnalysisProfile = (id: string | null) =>
  id && Object.hasOwn(analysisProfiles, id) ? analysisProfiles[id] : undefined;
