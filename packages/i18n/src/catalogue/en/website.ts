/** The console's website editor (#129; decision 0270). */
export const website = {
  title: 'Website',
  notAllowed: 'Your role does not include the website. Ask an admin if you need it.',
  hint: 'Change a page\u2019s words in place, save a draft and preview it as the website shows it, then publish it now or at a time. Every version is kept: publish an earlier one again from its history.',
  page: 'Page',
  choosePage: 'Choose a page to edit.',
  /** `Block 2 · cards`. */
  block: 'Block {number} · {kind}',
  /** `Title 2`: the second in a list. */
  fieldNumber: '{field} {number}',
  fields: {
    eyebrow: 'Eyebrow', heading: 'Heading', text: 'Text', note: 'Note', body: 'Body', intro: 'Introduction', title: 'Title', label: 'Label',
    alt: 'Picture description', quote: 'Quote', question: 'Question', answer: 'Answer', apply: 'How to apply', address: 'Address', hours: 'Hours',
    value: 'Figure', phone: 'Phone', email: 'Email', when: 'When', lines: 'Line', points: 'Point', rules: 'Rule', phrases: 'Phrase',
    paragraphs: 'Paragraph',
  },
  save: 'Save draft',
  saved: 'Draft saved. The preview shows it as the website will.',
  publish: 'Publish now',
  published: 'Published. The website shows it now.',
  publishAt: 'Publish at',
  schedule: 'Schedule',
  scheduled: 'Scheduled for {when}.',
  restored: 'That version is published again.',
  /** `Preview of House rules`. */
  preview: 'Preview of {page}',
  saveToPreview: 'Save a draft to preview it.',
  noPreview: 'The preview needs the website\u2019s address set for the console. Publishing works without it.',
  history: {
    title: 'History',
    none: 'No versions yet: the first save keeps what the page shows now.',
    when: 'When',
    status: 'Version',
    statuses: { draft: 'Draft', scheduled: 'Scheduled', published: 'On the website', replaced: 'Earlier' },
    restore: 'Publish again',
    restoreName: 'Publish the version of {when} again',
  },
  failures: {
    not_allowed: 'Your role does not include the website. Ask an admin if you need it.',
    gone: 'That page or version is no longer there.',
    invalid: 'A block cannot be shown as it is. Check its words, then save again.',
    paused: 'The club is paused: edit the website when it reopens.',
    unavailable: 'That did not go through. Try again.',
  },
} as const;
