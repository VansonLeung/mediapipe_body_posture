type Figure = {
  kind: 'figure';
  head: [number, number];
  arms: string[];
  legs: string[];
  torso: string;
};
type Lines = { kind: 'lines'; head: [number, number]; lines: string[] };
export type Illustration = (Figure | Lines) & { frames?: (Figure | Lines)[] };
const files = import.meta.glob('../../catalog/assets/*.json', {
  eager: true,
  import: 'default',
});
const illustrations = new Map<string, Illustration>();
const paths = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every(
    (s) => typeof s === 'string' && /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(s),
  );
function valid(v: unknown): v is Illustration {
  if (!v || typeof v !== 'object') return false;
  const p = v as Illustration;
  return (
    Array.isArray(p.head) &&
    p.head.length === 2 &&
    p.head.every(Number.isFinite) &&
    (p.kind === 'figure'
      ? paths(p.arms) && paths(p.legs) && paths([p.torso])
      : p.kind === 'lines' && paths(p.lines)) &&
    (p.frames === undefined ||
      (Array.isArray(p.frames) && p.frames.length > 0 && p.frames.every(valid)))
  );
}
for (const [path, raw] of Object.entries(files)) {
  if (!valid(raw)) throw new Error(`Invalid illustration: ${path}`);
  illustrations.set(path.split('/').pop()!.replace('.json', ''), raw);
}
export const getIllustration = (id: string | null) =>
  id ? illustrations.get(id) : undefined;
