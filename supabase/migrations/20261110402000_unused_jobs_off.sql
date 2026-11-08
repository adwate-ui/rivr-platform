-- Fewer scheduled jobs (audit F-109). Five outbox consumers run every minute for features that are hidden or have no vendor,
-- and have never delivered anything on staging or production (counted 9 Nov): they stop. The code stays: to turn one back on,
-- select private.schedule_outbox_consumer('<its Edge Function>'). It then takes events up to 30 days old. withdrawal-payout and
-- payout-name-check go back on with the withdrawal screens: the name check fails open without its job.
--
-- Two the audit named stay, less often. KYC recheck is the only check of a PAN taken at the desk once kyc.at_the_club is off
-- (decisions 0271, 0502), and nothing would restart it: every quarter hour. The bonus sweep closes grants a freeze held past
-- their end (decision 0504): hourly.

select cron.unschedule(j.jobname) from cron.job j
where j.jobname in ('outbox-withdrawal-payout', 'outbox-payout-name-check', 'outbox-google-ads', 'outbox-meta-conversions', 'outbox-social-publish');

select private.schedule_outbox_consumer('kyc-recheck', '*/15 * * * *');
select cron.schedule('bonus-expiry', '7 * * * *', 'select private.expire_bonus()');
