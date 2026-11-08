/** Marketing: promotions, the rewards catalogue, social, the website and Learn's sources. */
import type { Workflow } from '../types.ts';
import { refusal, step } from './step.ts';

export const MARKETING: readonly Workflow[] = [
  {
    key: 'promotion',
    title: 'Marketing makes a promotion and a super admin approves it',
    steps: [
      step('marketing', 'console', '/promotions', 'makes a promotion and submits it'),
      step('super_admin', 'console', '/promotions', 'approves it; ended promotions show apart'),
      step('member', 'player', '/rewards', 'sees the offer, and gets it by WhatsApp if they opted in'),
    ],
    refusals: [refusal('marketing', '/promotions', 'marketing cannot approve their own promotion')],
    endState: 'at most one marketing message a member a night',
  },
  {
    key: 'rewards-catalogue',
    title: 'Marketing adds a reward with limited stock',
    steps: [step('marketing', 'console', '/rewards?tab=rewards', 'adds a reward with 30 in stock')],
    refusals: [],
    endState: 'members can redeem it until the stock runs out',
  },
  {
    key: 'social',
    title: 'Marketing publishes a post',
    steps: [step('marketing', 'console', '/social', 'writes and publishes a post')],
    refusals: [],
    endState: 'the post is queued for the channels',
  },
  {
    key: 'website-edit',
    title: 'Marketing edits a website page, previews it and publishes it',
    steps: [
      step('marketing', 'console', '/content?tab=website', 'edits a page'),
      step('visitor', 'web', '/preview/$token', 'opens the preview'),
      step('visitor', 'web', '/$slug', 'sees the published page'),
    ],
    refusals: [],
    endState: 'the page is live on the website',
  },
  {
    key: 'learn-sources',
    title: 'A super admin manages Learn’s sources',
    steps: [step('super_admin', 'console', '/content?tab=learn', 'adds a source'), step('member', 'player', '/learn', 'sees it')],
    refusals: [],
    endState: 'the source is in Learn',
  },
];
