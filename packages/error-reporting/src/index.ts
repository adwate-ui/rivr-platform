// Error reporting to Sentry for the web apps (#928, decisions 0604, 0672 and 0673). An app makes its own in the first
// module its entry imports, so it listens from that moment; nothing else in the repository posts to Sentry.
export { createErrorReporting, routePatternOf, type ErrorReporting, type ErrorReportingOptions } from './errorReporting.ts';
