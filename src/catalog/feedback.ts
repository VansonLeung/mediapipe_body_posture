import messages from '../../catalog/messages/feedback.json';
import type { StudioLanguage } from './schema';
export type FeedbackId = keyof typeof messages;
export const feedback = (id: FeedbackId, language: StudioLanguage = 'en') =>
  messages[id][language];
const byEnglish = new Map(Object.values(messages).map((m) => [m.en, m]));
// Historical summaries stored English cues; retain their translations after migration.
export const translateFeedback = (text: string, language: StudioLanguage) =>
  byEnglish.get(text)?.[language] ?? text;
