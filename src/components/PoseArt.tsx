import { getExercise } from '../catalog';
import type { ExerciseId } from '../catalog';
import { getIllustration } from '../catalog/assets';
import { tweenIllustration } from '../lib/illustrationTween';
import type { TweenedIllustration } from '../lib/illustrationTween';
export function PoseArt({
  pose,
  className = '',
  outline = false,
  demoFrame,
  demoProgress = 0,
}: {
  pose: ExerciseId;
  className?: string;
  outline?: boolean;
  demoFrame?: number;
  demoProgress?: number;
}) {
  const exercise = getExercise(pose);
  const asset = getIllustration(exercise.data.presentation.illustration);
  const frame =
    demoFrame !== undefined && asset?.frames
      ? asset.frames[demoFrame % asset.frames.length]
      : asset;
  const art: TweenedIllustration | undefined =
    frame && asset?.frames && demoFrame !== undefined && demoProgress > 0
      ? tweenIllustration(
          frame,
          asset.frames[(demoFrame + 1) % asset.frames.length],
          demoProgress,
        )
      : frame;
  const skin = outline ? '#739488' : '#b98267',
    shirt = outline ? '#597b6d' : '#eef0d3',
    pants = outline ? '#597b6d' : '#426c57';
  return (
    <svg
      viewBox="0 0 208 190"
      className={className}
      role="img"
      aria-label={`${exercise.name} movement illustration`}
    >
      <path d="M20 175H188" stroke="#739488" strokeWidth="2" opacity=".3" />
      {art ? (
        <>
          {art.kind === 'figure' ? (
            <>
              {art.legs.map((d, i) => (
                <path
                  key={`leg-${i}`}
                  d={d}
                  fill="none"
                  stroke={pants}
                  strokeWidth="15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {art.arms.map((d, i) => (
                <path
                  key={`arm-${i}`}
                  d={d}
                  fill="none"
                  stroke={skin}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              <path
                d={`M${art.head[0]} ${art.head[1] + 9}L${art.head[0]} ${art.head[1] + 24}`}
                stroke={skin}
                strokeWidth="10"
              />
              <path d={art.torso} fill={shirt} />
            </>
          ) : (
            art.lines.map((points, i) => (
              <polyline
                key={i}
                points={points}
                fill="none"
                stroke={pants}
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={art.lineOpacities?.[i] ?? 1}
              />
            ))
          )}
          <circle cx={art.head[0]} cy={art.head[1]} r="12" fill={skin} />
        </>
      ) : (
        <g fill="none" stroke={pants} strokeWidth="3">
          <rect x="44" y="48" width="120" height="88" rx="10" opacity=".65" />
          <path d="M91 70L124 92L91 114Z" fill={pants} stroke="none" />
        </g>
      )}
    </svg>
  );
}
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M8 26V7h18M8 16h13"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="24" cy="25" r="3.2" fill="currentColor" />
      </svg>
      {!small && (
        <span>
          forma<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
