-- A practice reset keeps the staff's console density (decision 0475), as it keeps the staff records it belongs to: it is a
-- staff member's own setting, not the venue's play. A live purge, which deletes from what a reset reloads, keeps it too, as
-- it keeps the staff. As in 20261102090100_notices.sql, with staff_preference.
create or replace function private.practice_reset_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audit_log', 'staff', 'staff_credential', 'device', 'device_pairing', 'tablet_assignment', 'computer_enrolment',
               'tv_screen', 'venue_config', 'setting', 'tier', 'tier_feature', 'chip_denomination', 'table_type', 'game_table', 'table_run',
               'invoice_series', 'sop', 'sop_version', 'sop_ack', 'quiz', 'quiz_attempt', 'site_block', 'site_page', 'site_revision', 'control_state',
               'contact', 'drill', 'camera', 'notice', 'staff_preference'];
$$;
