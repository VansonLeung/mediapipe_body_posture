import { useState } from 'react';
import { Button, Input, InputNumber, Select } from 'antd';
import {
  availableExercises as exercises,
  getExercise,
  findExercise,
  isAvailableExercise,
  routineTemplates,
  localizeExercise,
} from '../catalog';
import type { ExerciseId } from '../catalog';
import type { StudioLanguage } from '../catalog';
import { canStartRoutine, unavailableSteps } from '../lib/routines';
import type { Routine, RoutineStep } from '../lib/routines';

export function RoutineBuilder({
  language,
  routines,
  onSave,
  onDelete,
  onStart,
}: {
  language: StudioLanguage;
  routines: Routine[];
  onSave: (routine: Routine) => void;
  onDelete: (id: string) => void;
  onStart: (routine: Routine) => void;
}) {
  const t = (en: string, zh: string) => (language === 'en' ? en : zh);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<RoutineStep[]>([]);
  const [selected, setSelected] = useState<ExerciseId>('standing-balance');
  const [editingId, setEditingId] = useState<string | null>(null);
  const move = (index: number, offset: number) =>
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  return (
    <section className="routine-builder">
      <h2 className="view-title">{t('Movement combinations', '動作組合')}</h2>
      <p>
        {t(
          'Build a sequence from individual movements. Confirm each step before moving on; review steps are completed by the teacher.',
          '以個別動作建立組合。確認每個步驟後再繼續；檢視類步驟由老師確認完成。',
        )}
      </p>
      <div className="routine-editor">
        <Input
          aria-label={t('Routine name', '組合名稱')}
          placeholder={t('Routine name', '組合名稱')}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="routine-add">
          <Select
            aria-label={t('Add movement', '加入動作')}
            showSearch
            optionFilterProp="label"
            value={selected}
            onChange={setSelected}
            options={exercises.map((e) => ({
              value: e.id,
              label: localizeExercise(e, language).name,
            }))}
          />
          <Button
            disabled={steps.length >= 30}
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                { exercise: selected, target: getExercise(selected).target },
              ])
            }
          >
            {t('Add step', '加入步驟')}
          </Button>
        </div>
        <ol className="routine-steps">
          {steps.map((step, index) => {
            const raw = findExercise(step.exercise);
            const e = raw ? localizeExercise(raw, language) : undefined;
            const available = isAvailableExercise(step.exercise);
            return (
              <li key={index}>
                <span>
                  {index + 1}. {e?.name ?? step.exercise}
                  {!available && (
                    <small className="unavailable-step">
                      {' '}
                      ·{' '}
                      {t(
                        'Unavailable in this collection',
                        '此動作不在本合集內',
                      )}
                    </small>
                  )}
                </span>
                {e?.support === 'automatic' ? (
                  <label>
                    <InputNumber
                      aria-label={`${t('Target for step', '步驟目標')} ${index + 1}`}
                      min={1}
                      max={300}
                      precision={0}
                      value={step.target}
                      onChange={(value) =>
                        setSteps((prev) =>
                          prev.map((s, i) =>
                            i === index ? { ...s, target: value ?? 1 } : s,
                          ),
                        )
                      }
                    />{' '}
                    {e.unit === 'seconds'
                      ? t('seconds', '秒')
                      : t('reps', '次')}
                  </label>
                ) : (
                  <small>{t('Teacher review', '老師檢視')}</small>
                )}
                <div className="routine-step-actions">
                  <Button
                    aria-label={`${t('Move up step', '上移步驟')} ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    aria-label={`${t('Move down step', '下移步驟')} ${index + 1}`}
                    disabled={index === steps.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    aria-label={`${t('Remove step', '移除步驟')} ${index + 1}`}
                    onClick={() =>
                      setSteps((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    ×
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        <Button
          type="primary"
          disabled={
            !name.trim() ||
            !steps.length ||
            steps.some((s) => !isAvailableExercise(s.exercise))
          }
          onClick={() => {
            onSave({
              id: editingId ?? crypto.randomUUID(),
              name: name.trim(),
              steps,
            });
            setName('');
            setSteps([]);
            setEditingId(null);
          }}
        >
          {t('Save combination', '儲存組合')}
        </Button>
        {editingId && (
          <Button
            onClick={() => {
              setEditingId(null);
              setName('');
              setSteps([]);
            }}
          >
            {t('Cancel edit', '取消編輯')}
          </Button>
        )}
      </div>
      <div className="routine-templates">
        <h3>{t('Starting combinations', '起步組合')}</h3>
        {routineTemplates.map((template) => (
          <article key={template.id}>
            <strong>{template.locales[language].name}</strong>
            <p>
              {template.steps
                .map(
                  (s) =>
                    localizeExercise(getExercise(s.exercise), language).name,
                )
                .join(' → ')}
            </p>
            <Button
              onClick={() => {
                setEditingId(null);
                setName(template.locales[language].name);
                setSteps(template.steps.map((s) => ({ ...s })));
              }}
            >
              {t('Use as a starting point', '以此建立組合')}
            </Button>
          </article>
        ))}
      </div>
      <div className="routine-list">
        {routines.length === 0 && (
          <p>{t('No saved combinations yet.', '尚未儲存任何組合。')}</p>
        )}
        {routines.map((r) => (
          <article key={r.id}>
            <h3>{r.name}</h3>
            <p>
              {r.steps
                .map((s) =>
                  findExercise(s.exercise)
                    ? localizeExercise(getExercise(s.exercise), language).name
                    : s.exercise,
                )
                .join(' → ')}
            </p>
            {unavailableSteps(r).length > 0 && (
              <p className="unavailable-step" role="status">
                {t(
                  'Edit this combination before practice. Unavailable steps: ',
                  '請先編輯此組合。未能使用的步驟：',
                )}
                {unavailableSteps(r)
                  .map(
                    (s) =>
                      `${s.index + 1}. ${findExercise(s.exercise) ? localizeExercise(getExercise(s.exercise), language).name : s.exercise}`,
                  )
                  .join(', ')}
              </p>
            )}
            <Button
              type="primary"
              disabled={!canStartRoutine(r)}
              onClick={() => onStart(r)}
            >
              {t('Practice combination', '練習組合')}
            </Button>
            <Button
              onClick={() => {
                setEditingId(r.id);
                setName(r.name);
                setSteps(r.steps.map((s) => ({ ...s })));
              }}
            >
              {t('Edit', '編輯')}
            </Button>
            <Button onClick={() => onDelete(r.id)}>
              {t('Delete', '刪除')}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
