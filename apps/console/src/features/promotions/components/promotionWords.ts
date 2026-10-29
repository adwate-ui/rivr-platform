/** A promotion's rules and questions as the website shows them (#618), from the builder's two boxes of text. */
export interface PromotionWords {
  readonly rules: string[];
  readonly questions: { question: string; answer: string }[];
}

/** The lines of some text with words on them, trimmed. */
function lines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

/**
 * The rules, one a line, and the questions, each a question on its line and its answer on the lines after it, a blank
 * line between one question and the next. A question with no answer is left out.
 */
export function promotionWords(rulesText: string, questionsText: string): PromotionWords {
  const questions = questionsText.split(/\n\s*\n/).flatMap((block) => {
    const [question, ...answer] = lines(block);
    return question === undefined || answer.length === 0 ? [] : [{ question, answer: answer.join(' ') }];
  });
  return { rules: lines(rulesText), questions };
}
