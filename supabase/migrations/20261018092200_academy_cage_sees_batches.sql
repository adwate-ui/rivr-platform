-- The cage confirms Academy payments (#8), so a cashier sees which batch each payment is for. Batches
-- hold no money and no personal data; cashiers still change nothing here but through the functions.
create policy "cage staff see the venue's batches" on public.academy_batch
  for select to authenticated
  using (venue_id in (select private.venues_where('cage.transact')));
