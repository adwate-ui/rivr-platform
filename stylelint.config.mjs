/**
 * Stylesheets live only in packages/ui (and the generated token CSS).
 * Apps hold no styles at all: any stylesheet under apps/ fails, empty or not.
 */
export default {
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
  },
  overrides: [
    {
      files: ['packages/tokens/**'],
      rules: { 'color-no-hex': null },
    },
    {
      files: ['apps/**'],
      rules: {
        'no-empty-source': [true, { message: 'Apps contain no stylesheets. Put visual work in @rivr/ui.' }],
        'selector-disallowed-list': [[/.*/], { message: 'Apps contain no stylesheets. Put visual work in @rivr/ui.' }],
        'at-rule-disallowed-list': [[/.*/], { message: 'Apps contain no stylesheets. Put visual work in @rivr/ui.' }],
        'property-disallowed-list': [[/.*/], { message: 'Apps contain no stylesheets. Put visual work in @rivr/ui.' }],
      },
    },
  ],
};
