-- CMG VIRTUAL four-step account, package and payment-proof setup.
-- Run this once in the SQL Editor of the Supabase project used by the live website.

-- Save customer profile details without changing existing roles or token balances.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone_number text;

-- Add payment sender details and a private storage object path.
alter table public.payments
  add column if not exists payer_name text,
  add column if not exists payer_phone text,
  add column if not exists screenshot_path text;

-- Transaction ID is optional in the new payment form.
alter table public.payments
  alter column transaction_reference drop not null;

-- Keep the package IDs stable where possible; update the old starter price/credit amount.
update public.packages
set name = 'Starter Plan', price = 150, credits = 3, active = true
where name = 'Starter Package'
  and not exists (select 1 from public.packages p2 where p2.name = 'Starter Plan');

update public.packages
set price = 150, credits = 3, active = true
where name = 'Starter Plan';

insert into public.packages (name, price, credits, active)
select 'Starter Plan', 150, 3, true
where not exists (select 1 from public.packages where name = 'Starter Plan');

insert into public.packages (name, price, credits, active)
select 'Pro Plan', 600, 15, true
where not exists (select 1 from public.packages where name = 'Pro Plan');

insert into public.packages (name, price, credits, active)
select 'Elite Plan', 1200, 30, true
where not exists (select 1 from public.packages where name = 'Elite Plan');

update public.packages set price = 600, credits = 15, active = true where name = 'Pro Plan';
update public.packages set active = false where name = 'Starter Package';
update public.packages set active = false where name = 'Starter Plan' and credits <> 3;
update public.packages set price = 1200, credits = 30, active = true where name = 'Elite Plan';

-- Private bucket: customers can upload only into their own user-ID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'CMG customers upload own payment proofs'
  ) then
    execute $policy$
      create policy "CMG customers upload own payment proofs"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'payment-proofs'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'CMG customers delete own payment proofs'
  ) then
    execute $policy$
      create policy "CMG customers delete own payment proofs"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'payment-proofs'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;
end $$;

create index if not exists payments_status_created_at_idx
  on public.payments (status, created_at desc);
