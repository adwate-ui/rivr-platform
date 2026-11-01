-- The caller's address (audit of 28 Oct, A4-17): Cloudflare's, else the last X-Forwarded-For hop, never the first, which
-- the client writes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

set local request.headers = '{"x-forwarded-for": "203.0.113.9, 10.0.0.1"}';
select is(private.request_ip(), '10.0.0.1'::inet, 'without Cloudflare, the address is the last hop, which the gateway added, not the first the client wrote');
set local request.headers = '{"x-forwarded-for": "203.0.113.9, 10.0.0.1", "cf-connecting-ip": "198.51.100.7"}';
select is(private.request_ip(), '198.51.100.7'::inet, 'with Cloudflare, its address, as before');
set local request.headers = '{}';
select is(private.request_ip(), null::inet, 'and with neither, none');

select * from finish();
rollback;
