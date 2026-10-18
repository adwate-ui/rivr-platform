// @ts-check
/**
 * Raw design values live only in packages/tokens. Everything else uses a token,
 * so a hex colour or an arbitrary Tailwind value outside tokens is an error.
 */

const HEX = '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
// A hex colour standing alone or inside CSS-like text: '#C9A85C', '1px solid #C9A85C'.
const HEX_IN_TEXT = `/(?:^|[\\s(:,])${HEX}(?=$|[\\s),;])/`;
// An arbitrary Tailwind value: w-[13px], bg-[#fff], hover:text-[12px].
// Arbitrary variants such as data-[state=open]: end with a colon and are allowed.
const ARBITRARY_VALUE = '/(?:^|\\s)[!\\w:-]*-\\[[^\\]\\s]+\\](?=\\s|$)/';

const HEX_MESSAGE = 'Hex colour outside @rivr/tokens. Use a token.';
const ARBITRARY_MESSAGE = 'Arbitrary Tailwind value. Use a value from the token scale.';

export const designValueRules = {
  files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
  ignores: ['packages/tokens/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: `Literal[value=${HEX_IN_TEXT}]`, message: HEX_MESSAGE },
      { selector: `TemplateElement[value.raw=${HEX_IN_TEXT}]`, message: HEX_MESSAGE },
      { selector: `Literal[value=${ARBITRARY_VALUE}]`, message: ARBITRARY_MESSAGE },
      { selector: `TemplateElement[value.raw=${ARBITRARY_VALUE}]`, message: ARBITRARY_MESSAGE },
    ],
  },
};
