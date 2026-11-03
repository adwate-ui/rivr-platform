// @ts-check
/**
 * Testing Library's waits (`findBy…`, `waitFor`) give up after 1 second by default, which a busy machine misses when turbo
 * runs every package's tests at once (#682, #718). Every jsdom package waits up to 5 seconds instead, set here once rather
 * than test by test, and well inside the 15 seconds a jsdom test has before it counts as hung (decision 0103).
 */
import { configure } from '@testing-library/dom';

configure({ asyncUtilTimeout: 5_000 });
