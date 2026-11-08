-- Investors see no Reports (the owner, 9 Nov). The owner_view role read the reports (reports.read), lately only the
-- money-free Tables view (decision 0508); it no longer does, so the console offers them no Reports and every report's
-- check (private.assert_reports and the reads that ask reports.read) refuses them.
delete from public.role_permission where role = 'owner_view' and permission = 'reports.read';
