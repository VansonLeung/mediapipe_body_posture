export type ExerciseId = 'warrior' | 'tree' | 'arms' | 'bend';
export interface Exercise {
  id: ExerciseId;
  name: string;
  subtitle: string;
  category: 'Yoga' | 'Warm-up';
  duration: string;
  target: number;
  unit: 'seconds' | 'reps';
  color: string;
  steps: string[];
  focus: string;
}
export const exercises: Exercise[] = [
  {
    id: 'warrior',
    name: 'Warrior II',
    subtitle: 'Strength & stability',
    category: 'Yoga',
    duration: '30 sec hold',
    target: 30,
    unit: 'seconds',
    color: 'sage',
    steps: [
      'Stand with your feet wide and turn one foot outward.',
      'Bend that knee and keep the other leg straight.',
      'Reach both arms out at shoulder height. Face your chest toward the camera.',
    ],
    focus: 'Ground your feet. Reach through your fingertips.',
  },
  {
    id: 'tree',
    name: 'Tree pose',
    subtitle: 'Balance & focus',
    category: 'Yoga',
    duration: '30 sec hold',
    target: 30,
    unit: 'seconds',
    color: 'sand',
    steps: [
      'Face the camera and shift your weight onto one leg.',
      'Place your other foot on your ankle or calf, avoiding the knee.',
      'Bring your palms together and keep your standing leg tall.',
    ],
    focus: 'Find a still point and take a steady breath.',
  },
  {
    id: 'arms',
    name: 'Arm raises',
    subtitle: 'Shoulder mobility',
    category: 'Warm-up',
    duration: '8 slow reps',
    target: 8,
    unit: 'reps',
    color: 'lavender',
    steps: [
      'Face the camera with your arms resting by your sides.',
      'Slowly lift both arms out to shoulder height.',
      'Lower your arms fully to complete a repetition.',
    ],
    focus: 'Move slowly. Keep your shoulders relaxed.',
  },
  {
    id: 'bend',
    name: 'Standing side bends',
    subtitle: 'Release & lengthen',
    category: 'Warm-up',
    duration: '8 slow reps',
    target: 8,
    unit: 'reps',
    color: 'peach',
    steps: [
      'Face the camera with your feet comfortably apart.',
      'Lean your upper body gently to one side, keeping your hips centered.',
      'Return upright to finish a repetition. Alternate sides.',
    ],
    focus: 'Create length through your side. Stay within a comfortable range.',
  },
];
export const getExercise = (id: ExerciseId) =>
  exercises.find((e) => e.id === id)!;
