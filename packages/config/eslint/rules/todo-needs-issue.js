// @ts-check
/**
 * A TODO, FIXME, XXX or HACK comment must link an issue, so unfinished work is tracked
 * where the lanes can see it: `// TODO(#42): ...` or a full issue URL.
 */

const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/;
const ISSUE_LINK = /#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/;

/** @type {import('eslint').Rule.RuleModule} */
export const todoNeedsIssue = {
  meta: {
    type: 'problem',
    docs: { description: 'Require an issue link on TODO, FIXME, XXX and HACK comments' },
    messages: { missing: '{{marker}} needs an issue link, for example "{{marker}}(#42): ..."' },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const marker = MARKER.exec(comment.value);
          if (marker && !ISSUE_LINK.test(comment.value) && comment.loc) {
            context.report({ loc: comment.loc, messageId: 'missing', data: { marker: marker[1] ?? '' } });
          }
        }
      },
    };
  },
};
