-- The kyc-in-person function clears PAN and Aadhaar files no row names (decision 0573): it lists the member's folder and reads
-- which paths are on file, as the server. The server's role was never let to read the table, so the read was refused and the
-- clearing never ran (the trial run, 13 Nov: 403 after every desk check). It reads the paths alone.
grant select (member_id, path) on public.kyc_document to service_role;
