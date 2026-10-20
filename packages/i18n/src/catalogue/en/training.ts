/** Staff training (#50): the console's Certification screen, and the dealer tablet in the practice venue. */

/** The console's Certification screen: the dealer and cashier quizzes, in the practice venue. */
export const certification = {
  title: 'Certification',
  /** At the club, which has no quizzes. */
  empty: 'Certification quizzes run in the practice venue. Turn on Practice venue at the foot of the rail, or if it is not there, ask a manager to add you to the practice venue\'s staff.',
  /** `{count}` questions; `{percent}` is the pass mark. */
  about: '{count} questions. A pass needs {percent}% right.',
  start: 'Start {title}',
  /** The signed-in staff member's standing on one quiz; `{date}` is in IST. */
  passed: 'You passed on {date} with {correct} of {count}. It is on your staff record.',
  notPassed: 'Your last try, on {date}: {correct} of {count}, not a pass yet.',
  notTaken: 'Not taken yet.',
  /** A question's chips are named by the question: `1. When do you log a hand on the tablet?` */
  question: '{number}. {prompt}',
  submit: 'Hand in answers',
  back: 'Back to quizzes',
  unanswered: 'Answer every question, then hand in.',
  resultPassed: 'Passed: {correct} of {count}. It is on your staff record.',
  resultNotPassed: 'Not a pass: {correct} of {count}. A pass needs {percent}% right. Read the procedures again and try once more.',
  tryAgain: 'Try again',
  /** Staff who manage staff: every attempt at the venue, on each staff record. */
  attempts: 'Attempts',
  noAttempts: 'Nobody has taken a quiz yet.',
  filter: 'Find a name',
  name: 'Name',
  quiz: 'Quiz',
  score: 'Score',
  result: 'Result',
  when: 'Taken',
  scoreValue: '{correct} of {count}',
  pass: 'Passed',
  fail: 'Not passed',
  notAllowed: 'Only staff at this venue take its quizzes. Ask a manager to add you to its staff.',
  paused: 'The venue is frozen. Quizzes are taken again once it is released.',
  invalid: 'Answer every question, then hand in.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
