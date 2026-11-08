-- A staff member's own switch for the console's single-key shortcuts (A, D and S on the Live floor, / for search), kept
-- beside their density (decision 0475) so it follows them to any computer at the club. WCAG 2.1.4 asks for a way to turn
-- such keys off (audit of 8 Nov 2026, F-003); the owner chose on until the staff member turns it off (8 Nov).

alter table public.staff_preference add column has_shortcuts boolean not null default true;

comment on column public.staff_preference.has_shortcuts is
  'Whether the console''s single-key shortcuts work for this staff member: on until they turn them off.';
