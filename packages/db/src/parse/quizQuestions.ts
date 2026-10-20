/** One question of a certification quiz (#50): its prompt and its choices, never the answer. */
export interface QuizQuestion {
  readonly prompt: string;
  readonly choices: readonly string[];
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** One question from the database's JSON, or null when it is not one: a prompt and at least two choices. */
function toQuestion(value: unknown): QuizQuestion | null {
  if (typeof value !== 'object' || value === null) return null;
  const prompt: unknown = Reflect.get(value, 'prompt');
  const choices: unknown = Reflect.get(value, 'choices');
  if (!isText(prompt) || !Array.isArray(choices) || choices.length < 2 || !choices.every(isText)) return null;
  return { prompt, choices: choices.filter(isText) };
}

/**
 * A quiz's questions as the database keeps them, or null when any is not as expected. Read by hand
 * rather than with a schema, so @rivr/db's main entry carries no Zod into the player app's bundle.
 */
export function toQuizQuestions(value: unknown): QuizQuestion[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const questions = value.map(toQuestion);
  return questions.every((question) => question !== null) ? questions.filter((question) => question !== null) : null;
}
