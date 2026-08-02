-- Run once to merge duplicate Instagram profiles and prevent recurrence.
begin;

-- Older installations may predate user-scoped ownership. Add the column safely
-- before grouping duplicates by site user.
alter table public.instagram_accounts
  add column if not exists owner_id text not null default 'owner';
alter table public.instagram_accounts add column if not exists identity_key text;

create index if not exists instagram_accounts_owner_idx
  on public.instagram_accounts (owner_id, created_at desc);

create or replace function public.set_instagram_account_identity_key()
returns trigger as $$
begin
  new.identity_key := lower(trim(both '@' from coalesce(nullif(new.instagram_api_username, ''), nullif(new.username, ''), new.id)));
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_instagram_account_identity_key on public.instagram_accounts;
create trigger set_instagram_account_identity_key
before insert or update of instagram_api_username, username on public.instagram_accounts
for each row execute function public.set_instagram_account_identity_key();

update public.instagram_accounts
set identity_key = lower(trim(both '@' from coalesce(nullif(instagram_api_username, ''), nullif(username, ''), id)));

create temporary table duplicate_account_map on commit drop as
with ranked as (
  select id, owner_id, identity_key,
    first_value(id) over (
      partition by owner_id, identity_key
      order by last_synced_at desc nulls last, updated_at desc nulls last, created_at desc, id
    ) as keep_id,
    row_number() over (
      partition by owner_id, identity_key
      order by last_synced_at desc nulls last, updated_at desc nulls last, created_at desc, id
    ) as position
  from public.instagram_accounts
  where identity_key is not null and identity_key <> ''
)
select id as duplicate_id, keep_id from ranked where position > 1;

update public.instagram_posts p set account_id = m.keep_id from duplicate_account_map m where p.account_id = m.duplicate_id;
update public.instagram_sync_runs r set account_id = m.keep_id from duplicate_account_map m where r.account_id = m.duplicate_id;
update public.instagram_monthly_reports r set account_id = m.keep_id from duplicate_account_map m where r.account_id = m.duplicate_id;
update public.instagram_media r set account_id = m.keep_id from duplicate_account_map m where r.account_id = m.duplicate_id;
update public.instagram_daily_snapshots r set account_id = m.keep_id from duplicate_account_map m where r.account_id = m.duplicate_id;
update public.instagram_account_insights r set account_id = m.keep_id from duplicate_account_map m where r.account_id = m.duplicate_id;

delete from public.instagram_accounts a using duplicate_account_map m where a.id = m.duplicate_id;

create unique index if not exists instagram_accounts_owner_identity_unique
  on public.instagram_accounts (owner_id, identity_key)
  where identity_key is not null and identity_key <> '';

commit;
