-- The cage agent is removed, by the owner on 15 Nov (decision 0651): the service on the cage computer that kept the nightly
-- offline pack on its disk and printed KOTs at the bar as the outbox consumer bar_printer. Its functions go, and the offline
-- pack's, which only the nightly job that fed the agent read. The bucket offline-packs is left as it is.
--
-- Kept: the device kind `agent` (no enum change) and the deliveries bar_printer left in the outbox, which still say on the
-- console's Food and drink screen that the bar printer missed a KOT (fnb_orders_tonight).

-- Agents' devices, and the codes they were added with. One the removed kill switch named (control_state, which is never
-- deleted) is revoked instead, so it stays no one.
delete from public.computer_enrolment e using public.device d where d.id = e.device_id and d.kind = 'agent';
delete from public.device d
where d.kind = 'agent' and not exists (select 1 from public.control_state c where c.device_id = d.id);
update public.device set revoked_at = now() where kind = 'agent' and revoked_at is null;
delete from private.device_pairing_miss where client like 'agent:%';

-- Enrolment, and who a token is.
drop function public.claim_agent(text, text, text);
drop function private.claim_agent(text, text, text);
drop function public.agent_device(text);
drop function private.agent_device(text);

-- Claiming and finishing KOTs as bar_printer.
drop function public.claim_agent_kots(uuid, integer);
drop function private.claim_agent_kots(uuid, integer);
drop function public.finish_agent_kot(uuid, uuid, boolean, text, integer, integer);
drop function private.finish_agent_kot(uuid, uuid, boolean, text, integer, integer);

-- The offline pack, which the nightly job rendered for the agent to fetch.
drop function public.offline_pack(uuid);
drop function private.offline_pack(uuid);
drop function public.offline_pack_venues();
drop function private.offline_pack_venues();
