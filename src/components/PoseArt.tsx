import type { ExerciseId } from '../lib/exercises';
export function PoseArt({
  pose,
  className = '',
  outline = false,
}: {
  pose: ExerciseId;
  className?: string;
  outline?: boolean;
}) {
  const skin = outline ? '#739488' : '#b98267',
    shirt = outline ? '#597b6d' : '#eef0d3',
    pants = outline ? '#597b6d' : '#426c57';
  const limbs: Record<
    ExerciseId,
    { arms: string[]; legs: string[]; head: [number, number]; torso: string }
  > = {
    warrior: {
      arms: ['M97 65 L62 68 L27 64', 'M110 65 L143 65 L177 62'],
      legs: ['M99 109 L63 130 L59 163', 'M109 109 L138 136 L159 164'],
      head: [103, 38],
      torso: 'M97 64 Q103 60 112 64 L117 105 Q105 115 92 106Z',
    },
    tree: {
      arms: ['M96 64 L80 88 L103 76', 'M113 64 L128 87 L105 76'],
      legs: ['M100 109 L99 139 L100 170', 'M109 109 L135 130 L103 145'],
      head: [104, 38],
      torso: 'M95 62 Q104 58 114 63 L116 109 L94 109Z',
    },
    arms: {
      arms: ['M94 65 L62 63 L31 61', 'M114 65 L146 63 L177 61'],
      legs: ['M99 111 L91 141 L87 170', 'M110 111 L118 141 L122 170'],
      head: [104, 38],
      torso: 'M94 63 Q105 59 115 63 L118 109 Q105 116 91 109Z',
    },
    bend: {
      arms: ['M91 66 L111 41 L141 39', 'M110 71 L123 99 L128 121'],
      legs: ['M100 112 L89 142 L82 170', 'M111 112 L122 142 L129 170'],
      head: [87, 43],
      torso: 'M84 63 Q93 56 103 62 L118 108 Q108 118 96 112Z',
    },
  };
  const p = limbs[pose];
  return (
    <svg
      viewBox="0 0 208 190"
      className={className}
      role="img"
      aria-label={`${pose === 'warrior' ? 'Warrior II' : pose === 'tree' ? 'Tree pose' : pose === 'arms' ? 'Arm raises' : 'Side bend'} reference illustration`}
    >
      <ellipse
        cx="104"
        cy="175"
        rx="77"
        ry="7"
        fill={outline ? '#739488' : '#688471'}
        opacity=".12"
      />
      <path
        d="M29 175H179"
        stroke={outline ? '#739488' : '#688471'}
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".3"
      />
      {p.legs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={pants}
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {p.arms.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={skin}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <path
        d={`M${p.head[0]} ${p.head[1] + 9}L${p.head[0]} ${p.head[1] + 24}`}
        stroke={skin}
        strokeWidth="10"
      />
      <path d={p.torso} fill={shirt} />
      <ellipse cx={p.head[0]} cy={p.head[1]} rx="12" ry="15" fill={skin} />
      <path
        d={`M${p.head[0] - 12} ${p.head[1] - 2}Q${p.head[0] - 17} ${p.head[1] - 21} ${p.head[0] + 3} ${p.head[1] - 17}Q${p.head[0] + 17} ${p.head[1] - 16} ${p.head[0] + 12} ${p.head[1] + 2}L${p.head[0] + 7} ${p.head[1] - 7}Q${p.head[0]} ${p.head[1] - 4} ${p.head[0] - 12} ${p.head[1] - 2}`}
        fill={outline ? '#739488' : '#343e32'}
      />
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
