-- Four more scheduled jobs stop, as 20261110402000_unused_jobs_off.sql stopped five (audit F-109). Their functions are not
-- set up on staging or production: live-status and native-push wait for the store accounts' push keys, social-wall for the
-- Instagram token, channel-analytics for its venue. Each scheduled call answered 503, about 3,100 a day on each project,
-- which buried real failures in the logs (the trial run, 13 Nov). The code stays. To turn one on once its keys are set
-- (docs/runbooks/ci-and-release.md): select private.schedule_outbox_consumer('<its Edge Function>'), with the schedule
-- '*/5 * * * *' for social-wall and '30 18 * * *' for channel-analytics. An outbox consumer then takes events up to 30
-- days old.

select cron.unschedule(j.jobname) from cron.job j
where j.jobname in ('outbox-live-status', 'outbox-native-push', 'outbox-social-wall', 'outbox-channel-analytics');
