/**
 * The WhatsApp templates RIVR sends, as they must be approved in Meta's dashboard (decision 0043).
 * The body is the text submitted for approval, with Meta's numbered parameters; `urlButton` marks a
 * template whose button opens the template's base address plus a suffix given at send time, as a
 * payment link or a receipt does. English only (decision 0027).
 */
export const WHATSAPP_TEMPLATES = {
  // The sign-in code (decision 0025). Evolution sends it as plain text from the club's own number (decision 0297), so the
  // text names the club and says what the code is for, as the app does.
  sign_in_code: {
    category: 'authentication',
    body: '{{1}} is your RIVR sign-in code. Never share it.',
    urlButton: false,
  },
  seat_ready: {
    category: 'utility',
    body: 'Your seat is ready. {{1}}, seat {{2}}. Hold expires {{3}}.',
    urlButton: false,
  },
  receipt_ready: {
    category: 'utility',
    body: 'Your RIVR receipt for {{1}} is ready.',
    urlButton: true,
  },
  payment_link: {
    category: 'utility',
    body: 'Pay {{1}} for {{2}} with the link below.',
    urlButton: true,
  },
  // The owner's alerts (#100): what happened in words, never its details; those are in the console (the owner dashboard
  // is switched off, so the text names no screen).
  owner_alert: {
    category: 'utility',
    body: 'RIVR alert: {{1}}. Check the RIVR console.',
    urlButton: false,
  },
  // What a member hears of while away from the app (decision 0303): utility messages, so no opt-in is asked.
  kyc_verified: {
    category: 'utility',
    body: 'Your ID is verified at RIVR Poker Club. You can request a seat in the app.',
    urlButton: false,
  },
  kyc_in_review: {
    category: 'utility',
    body: 'RIVR is checking your details. A message follows once it is done.',
    urlButton: false,
  },
  // A refusal the desk can look at again: why, in words, then where to go.
  kyc_refused: {
    category: 'utility',
    body: 'RIVR could not verify you: {{1}}. Bring your Aadhaar and PAN to the front desk.',
    urlButton: false,
  },
  // A refusal for age, which no document changes. It names no age: the club's minimum is a setting, 18 to 25 (kyc.minimum_age).
  kyc_under_age: {
    category: 'utility',
    body: "RIVR could not verify you. You are under the club's minimum age.",
    urlButton: false,
  },
  reward_cancelled: {
    category: 'utility',
    body: 'RIVR cancelled your {{1}}, and what you spent on it is back. See why in Rewards in the RIVR app.',
    urlButton: false,
  },
  // A seat on the leaving list has ended, whether its call time ran out or the member left early.
  seat_released: {
    category: 'utility',
    body: 'RIVR: you are free to go from {{1}}, seat {{2}}. Thank you for playing.',
    urlButton: false,
  },
  // A tournament the member asked about or is registered for (the owner, 9 Nov): {{2}} is its new day and time.
  tournament_withdrawn: {
    category: 'utility',
    body: 'RIVR: {{1}} will not run. If you have paid for a place, ask at the desk.',
    urlButton: false,
  },
  tournament_moved: {
    category: 'utility',
    body: 'RIVR: {{1}} has moved. It now starts {{2}}.',
    urlButton: false,
  },
  promotion: {
    category: 'marketing',
    // Meta refuses a body that is mostly a parameter. Opting out is Profile's Offers switch, until #154 reads replies.
    body: 'RIVR Poker Club: {{1}} To stop offers, turn off Offers in Profile in the RIVR app.',
    urlButton: false,
  },
  // After a member's third visit (#159): once, whatever their feedback, and with no reward.
  review_request: {
    category: 'marketing',
    body: 'Thank you for playing at RIVR Poker Club. A Google review helps the club: {{1}} To stop these, turn off Offers in Profile in the RIVR app.',
    urlButton: false,
  },
} as const;

/** The name of a template RIVR sends. */
export type WhatsAppTemplateName = keyof typeof WHATSAPP_TEMPLATES;
