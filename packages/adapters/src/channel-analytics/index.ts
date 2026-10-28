export type { ChannelAnalyticsAdapter, FollowerCount } from './types.ts';
export { createFakeChannelAnalytics, type FakeChannelAnalytics } from './fake.ts';
export { collectFollowerCounts, createChannelAnalytics, followerSources, type FollowerSource } from './live.ts';
