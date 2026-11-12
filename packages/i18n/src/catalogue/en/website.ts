/** The console's website editor (#129; decision 0270). */
export const website = {
  title: 'Website',
  notAllowed: 'Not in your role. Ask an admin.',
  /** The pages beside the editor (console v3): found by name or address, in three groups. */
  list: 'Pages',
  find: 'Find a page',
  noMatch: 'No page matches.',
  groups: { club: 'Club', guides: 'Guides', legal: 'Legal' },
  /** The two pages titled with the club's name, named apart in the list. */
  pages: { home: 'Home', links: 'Link in bio' },
  /** On a phone, from the editor back to the pages. */
  back: 'Back to the pages',
  noPages: 'The website has no pages yet.',
  /** `Section 2 · Cards`. */
  block: 'Section {number} · {kind}',
  /** A section's menu (#906). */
  sectionMenu: 'More for section {number}',
  addAbove: 'Add a section above',
  addBelow: 'Add a section below',
  changeKind: 'Change kind',
  moveUp: 'Move up',
  moveDown: 'Move down',
  deleteSection: 'Delete section',
  addSection: 'Add a section',
  /** Over the kinds to choose from. */
  chooseKind: {
    above: 'New section above section {number}',
    below: 'New section below section {number}',
    kind: 'Change section {number} to',
    end: 'New section at the end',
  },
  cancel: 'Cancel',
  /** A list's items (#906): `Remove`, read as `Remove Rule 3`. */
  remove: 'Remove',
  removeItem: 'Remove {item}',
  add: {
    rules: 'Add a rule', points: 'Add a point', lines: 'Add a line', paragraphs: 'Add a paragraph', phrases: 'Add a phrase', cards: 'Add a card',
    questions: 'Add a question', roles: 'Add a role', figures: 'Add a figure', links: 'Add a link', items: 'Add an item',
  },
  /** Each kind of block, as the editor names it. */
  kinds: {
    hero: 'Hero', statement: 'Statement', gallery: 'Gallery', feature: 'Feature', text: 'Text', rules: 'Rules', faq: 'Questions',
    careers: 'Careers', map: 'Map', games: 'Games', calendar: 'Calendar', links: 'Links', story: 'Story', cards: 'Cards',
    marquee: 'Phrases', timeline: 'Timeline', table: 'Table', promotions: 'Promotions', social_wall: 'Social wall',
    league: 'League standings', rewards: 'Rewards by table', outstation: 'Cab and hotel', jackpot: 'Jackpot and rare hands', other: 'Block',
  },
  /** `Title 2`: the second in a list. */
  fieldNumber: '{field} {number}',
  /** What each item of a list is, over its fields: `Question 1` (F-040). */
  items: { cards: 'Card', questions: 'Question', roles: 'Role', figures: 'Figure', links: 'Link', items: 'Item' },
  /** A figure's two fields, numbered in their own names, so tabbing through them never hears the same two (F-094). */
  figureLabel: 'Figure {number} label',
  figureValue: 'Figure {number} value',
  fields: {
    eyebrow: 'Line above heading', heading: 'Heading', text: 'Text', note: 'Note', body: 'Body', intro: 'Introduction', title: 'Title', label: 'Label',
    alt: 'Picture description', quote: 'Quote', question: 'Question', answer: 'Answer', apply: 'How to apply', address: 'Address', hours: 'Hours',
    value: 'Figure', phone: 'Phone', email: 'Email', when: 'When', lines: 'Line', points: 'Point', rules: 'Rule', phrases: 'Phrase',
    paragraphs: 'Paragraph', linkLabel: 'Link label', actionLabel: 'Button label',
  },
  save: 'Save draft',
  saved: 'Draft saved.',
  /** Beside the actions (F-029): `{time}` is 2 min. */
  savedAgo: 'Saved {time} ago',
  savedJustNow: 'Saved just now',
  /** The fields or the preview. */
  view: 'View',
  viewEdit: 'Edit',
  viewPreview: 'Preview',
  publishLater: 'Publish later',
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
    invalid: 'A section has a problem. Check its words.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
