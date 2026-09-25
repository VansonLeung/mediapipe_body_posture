import type { Illustration } from '../catalog/assets';

export type TweenedIllustration = Illustration & { lineOpacities?: number[] };
type Point = [number, number];
const numbers = /-?(?:\d*\.)?\d+/g;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const format = (n: number) => String(Math.round(n * 1000) / 1000);
function points(value: string): Point[] {
  const values = (value.match(numbers) ?? []).map(Number);
  return Array.from({ length: values.length / 2 }, (_, i) => [
    values[i * 2],
    values[i * 2 + 1],
  ]);
}
function resample(input: Point[], count: number): Point[] {
  if (input.length < 2)
    return Array.from({ length: count }, () => input[0] ?? [0, 0]);
  const lengths = [0];
  for (let i = 1; i < input.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          input[i][0] - input[i - 1][0],
          input[i][1] - input[i - 1][1],
        ),
    );
  const total = lengths.at(-1)!;
  return Array.from({ length: count }, (_, i) => {
    const distance = (total * i) / (count - 1);
    let segment = 1;
    while (segment < input.length - 1 && lengths[segment] < distance) segment++;
    const fraction =
      (distance - lengths[segment - 1]) /
      (lengths[segment] - lengths[segment - 1] || 1);
    return [
      lerp(input[segment - 1][0], input[segment][0], fraction),
      lerp(input[segment - 1][1], input[segment][1], fraction),
    ];
  });
}
function tweenPoints(
  from: Point[],
  to: Point[],
  t: number,
  limb: boolean,
): Point[] {
  if (from.length !== to.length) {
    const count = Math.max(from.length, to.length);
    from = resample(from, count);
    to = resample(to, count);
  }
  const result: Point[] = [];
  for (let i = 0; i < from.length; i++) {
    if (!limb || i === 0) {
      result.push([
        lerp(from[i][0], to[i][0], t),
        lerp(from[i][1], to[i][1], t),
      ]);
      continue;
    }
    const ax = from[i][0] - from[i - 1][0],
      ay = from[i][1] - from[i - 1][1];
    const bx = to[i][0] - to[i - 1][0],
      by = to[i][1] - to[i - 1][1];
    const start = Math.atan2(ay, ax),
      end = Math.atan2(by, bx);
    const turn = Math.atan2(Math.sin(end - start), Math.cos(end - start));
    const angle = start + turn * t;
    const length = lerp(Math.hypot(ax, ay), Math.hypot(bx, by), t);
    result.push([
      result[i - 1][0] + Math.cos(angle) * length,
      result[i - 1][1] + Math.sin(angle) * length,
    ]);
  }
  return result;
}
const serialize = (p: Point[]) =>
  p.map(([x, y]) => `${format(x)},${format(y)}`).join(' ');
function tweenPath(from: string, to: string, t: number, limb = false) {
  const commands = from.match(/[a-z]/gi)?.join('');
  if (commands !== to.match(/[a-z]/gi)?.join('')) return t < 0.5 ? from : to;
  if (limb && commands === 'MLL') {
    const p = tweenPoints(points(from), points(to), t, true);
    return p
      .map(([x, y], i) => `${i ? 'L' : 'M'}${format(x)} ${format(y)}`)
      .join(' ');
  }
  const a = from.match(numbers) ?? [],
    b = to.match(numbers) ?? [];
  if (a.length !== b.length) return t < 0.5 ? from : to;
  let index = 0;
  return from.replace(numbers, (value) =>
    format(lerp(Number(value), Number(b[index++]), t)),
  );
}

// Only schematic artwork is interpolated; these poses never enter camera analysis.
export function tweenIllustration(
  from: Illustration,
  to: Illustration,
  progress: number,
): TweenedIllustration {
  const fraction = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0;
  if (fraction === 0) return from;
  if (fraction === 1) return to;
  const t = fraction * fraction * (3 - 2 * fraction);
  const head: Point = [
    lerp(from.head[0], to.head[0], t),
    lerp(from.head[1], to.head[1], t),
  ];
  if (from.kind === 'lines' && to.kind === 'lines') {
    const count = Math.max(from.lines.length, to.lines.length);
    return {
      kind: 'lines',
      head,
      lines: Array.from({ length: count }, (_, i) => {
        const a = from.lines[i],
          b = to.lines[i];
        if (!a || !b) return a ?? b;
        // Line assets use torso, two arms, two legs, then optional annotations.
        return serialize(tweenPoints(points(a), points(b), t, i > 0 && i < 5));
      }),
      lineOpacities: Array.from({ length: count }, (_, i) =>
        from.lines[i] && to.lines[i] ? 1 : from.lines[i] ? 1 - t : t,
      ),
    };
  }
  if (
    from.kind === 'figure' &&
    to.kind === 'figure' &&
    from.arms.length === to.arms.length &&
    from.legs.length === to.legs.length
  )
    return {
      kind: 'figure',
      head,
      torso: tweenPath(from.torso, to.torso, t),
      arms: from.arms.map((v, i) => tweenPath(v, to.arms[i], t, true)),
      legs: from.legs.map((v, i) => tweenPath(v, to.legs[i], t, true)),
    };
  return t < 0.5 ? from : to;
}
