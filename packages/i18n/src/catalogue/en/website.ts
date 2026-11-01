/** The console's website editor (#129; decision 0270). */
export const website = {
  title: 'Website',
  notAllowed: 'Not in your role. Ask an admin.',
  hint: 'Change a page\u2019s words in place, save a draft and preview it as the website shows it, then publish it now or at a time. Every version is kept: publish an earlier one again from its history.',
  page: 'Page',
  choosePage: 'Choose a page to edit.',
  noPages: 'The website has no pages yet.',
  /** `Block 2 · Cards`. */
  block: 'Block {number} · {kind}',
  /** Each kind of block, as the editor names it. */
  kinds: {
    hero: 'Hero', statement: 'Statement', gallery: 'Gallery', feature: 'Feature', text: 'Text', rules: 'Rules', faq: 'Questions',
    careers: 'Careers', map: 'Map', games: 'Games', calendar: 'Calendar', links: 'Links', story: 'Story', cards: 'Cards',
    marquee: 'Phrases', timeline: 'Timeline', table: 'Table', promotions: 'Promotions', social_wall: 'Social wall',
    league: 'League standings', rewards: 'Rewards by table', outstation: 'Cab and hotel', jackpot: 'Jackpot and rare hands', other: 'Block',
  },
  /** `Title 2`: the second in a list. */
  fieldNumber: '{field} {number}',
  fields: {
    eyebrow: 'Eyebrow', heading: 'Heading', text: 'Text', note: 'Note', body: 'Body', intro: 'Introduction', title: 'Title', label: 'Label',
    alt: 'Picture description', quote: 'Quote', question: 'Question', answer: 'Answer', apply: 'How to apply', address: 'Address', hours: 'Hours',
    value: 'Figure', phone: 'Phone', email: 'Email', when: 'When', lines: 'Line', points: 'Point', rules: 'Rule', phrases: 'Phrase',
    paragraphs: 'Paragraph',
  },
  save: 'Save draft',
  saved: 'Draft saved.',
  publish: 'Publish now',
  published: 'Published.',
  publishOn: 'Publish on',
  publishAt: 'At',
  timeHint: '24-hour, IST, such as 18:00.',
  schedule: 'Schedule',
  scheduled: 'Scheduled for {when}.',
  restored: 'That version is published again.',
  /** `Preview of House rules`. */
  preview: 'Preview of {page}',
  saveToPreview: 'Save a draft to preview it.',
  /** A newer version came in while this one was being edited (F2-26). */
  newerVersion: 'A newer version came in. Saving makes your edits the draft.',
  noPreview: 'No preview: the website address is not set. Saving still works.',
  history: {
    title: 'History',
    none: 'No versions yet.',
    when: 'When',
    status: 'Version',
    statuses: { draft: 'Draft', scheduled: 'Scheduled', published: 'On the website', replaced: 'Earlier' },
    restore: 'Publish again',
    restoreName: 'Publish the version of {when} again',
    /** Publish again's second press: the version goes live at once. */
    confirmRestore: 'Yes, publish it now',
  },
  failures: {
    not_allowed: 'Not in your role. Ask an admin.',
    gone: 'That page or version is no longer there.',
    invalid: 'A block has a problem. Check its words.',
    paused: 'The club is paused: edit the website when it reopens.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
