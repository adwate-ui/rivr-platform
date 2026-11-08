import { describe, expect, it } from 'vitest';
import { readCatalogue, type Catalogue } from './catalogue.ts';
import { computeCoverage, uncoveredScreens, unknownScreens } from './coverage.ts';
import type { Workflow } from './types.ts';
import { WORKFLOWS } from './workflows/index.ts';

const catalogue = await readCatalogue();

describe('WORKFLOWS', () => {
  it('opens only screens the apps have', () => {
    expect(unknownScreens(catalogue.screens, WORKFLOWS)).toEqual([]);
  });

  it('opens every live screen in at least one step', () => {
    expect(uncoveredScreens(catalogue.screens, WORKFLOWS)).toEqual([]);
  });

  it('gives each workflow its own key, steps and end state', () => {
    expect(new Set(WORKFLOWS.map((workflow) => workflow.key)).size).toBe(WORKFLOWS.length);
    for (const workflow of WORKFLOWS) {
      expect(workflow.steps.length, workflow.key).toBeGreaterThan(0);
      expect(workflow.endState.length, workflow.key).toBeGreaterThan(0);
    }
  });
});

describe('the checks themselves', () => {
  const tiny: Catalogue = {
    screens: [
      { app: 'player', path: '/', kind: 'menu', anyOf: [], source: 'x' },
      { app: 'player', path: '/rewards', kind: 'menu', anyOf: [], source: 'x' },
      { app: 'console', path: '/cage', kind: 'hidden', anyOf: [], source: 'x' },
    ],
    rpcs: [
      { name: 'door_scan', module: 'door', source: 'x' },
      { name: 'my_rewards', module: 'myRewards', source: 'x' },
    ],
  };
  const one: Workflow = {
    key: 'w',
    title: 'w',
    steps: [{ actor: 'member', app: 'player', screen: '/', does: 'x' }],
    refusals: [{ actor: 'member', screen: '/nowhere', expect: 'x' }],
    endState: 'x',
  };

  it('names screens nobody opens and steps that open nothing', () => {
    expect(uncoveredScreens(tiny.screens, [one])).toEqual(['player /rewards']);
    expect(unknownScreens(tiny.screens, [one])).toEqual(['w: refusal at /nowhere']);
  });

  it('counts what a run saw, and lists every gap', () => {
    const coverage = computeCoverage(tiny, [one], {
      visited: new Set(['player /']),
      called: new Set(['door_scan']),
      pairsChecked: 3,
      pairsTotal: 4,
      walksFinished: new Set(),
    });
    expect(coverage).toMatchObject({ screensVisited: 1, screensTotal: 2, rpcsCalled: 1, rpcsTotal: 2, pairsChecked: 3, walksFinished: 0, walksTotal: 1 });
    expect(coverage.gaps).toEqual(['screen not visited: player /rewards', 'walk not finished: w', 'never called: myRewards.my_rewards']);
  });
});
