import { useState } from 'react';
import { Button, Input } from 'antd';
import type { StudioLanguage } from '../catalog';
export const reviewTime = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, '0')}:${(time % 60).toFixed(2).padStart(5, '0')}`;
export function TeacherReview({
  language,
  active,
  video,
  time,
  attempts,
  notes,
  onMark,
  onRemove,
  onNotes,
  onSeek,
}: {
  language: StudioLanguage;
  active: boolean;
  video: boolean;
  time: number;
  attempts: { time: number; note: string }[];
  notes: string;
  onMark: (time: number, note: string) => void;
  onRemove: (index: number) => void;
  onNotes: (value: string) => void;
  onSeek: (time: number) => void;
}) {
  const t = (en: string, zh: string) => (language === 'en' ? en : zh);
  const [note, setNote] = useState('');
  return (
    <div className="teacher-review">
      <p>
        {t(
          'No automatic score. Mark attempts and add your observations.',
          '不提供自動評分。請標記動作次數並加入觀察記錄。',
        )}
      </p>
      <Input
        aria-label={t('Attempt note', '單次動作備註')}
        placeholder={t(
          'Note for this attempt (optional)',
          '本次動作備註（選填）',
        )}
        value={note}
        maxLength={500}
        disabled={!active}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        block
        disabled={!active}
        onClick={() => {
          onMark(time, note.trim());
          setNote('');
        }}
      >
        {t('Mark attempt', '標記一次動作')} · {reviewTime(time)}
      </Button>
      <p>
        {t('Teacher-marked attempts', '老師標記次數')}:{' '}
        <strong>{attempts.length}</strong>
      </p>
      <ol className="attempt-list">
        {attempts.map((attempt, i) => (
          <li key={i}>
            <button disabled={!video} onClick={() => onSeek(attempt.time)}>
              {reviewTime(attempt.time)}
            </button>
            <span>{attempt.note || t('Attempt', '動作')}</span>
            <Button
              type="text"
              disabled={!active}
              aria-label={`${t('Remove attempt', '移除記錄')} ${i + 1}`}
              onClick={() => onRemove(i)}
            >
              ×
            </Button>
          </li>
        ))}
      </ol>
      <Input.TextArea
        aria-label={t('Session notes', '課節備註')}
        placeholder={t('Teacher observations', '老師觀察記錄')}
        maxLength={2000}
        rows={3}
        value={notes}
        disabled={!active}
        onChange={(e) => onNotes(e.target.value)}
      />
      <small>
        {video
          ? t(
              'Markers refer to this video. Summaries save markers and notes, not the video.',
              '標記對應本影片。摘要只儲存標記及備註，不會儲存影片。',
            )
          : t(
              'Markers use session time. The camera feed is not recorded.',
              '標記使用課節時間。攝影機畫面不會被錄影。',
            )}
      </small>
    </div>
  );
}
