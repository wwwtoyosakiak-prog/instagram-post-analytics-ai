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

-- Keep all work inside one statement. This avoids SQL editors that do not retain
-- temporary tables between statements.
do $$
declare
  duplicate record;
begin
  for duplicate in
    with ranked as (
      select id,
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
    select id as duplicate_id, keep_id from ranked where position > 1
  loop
    update public.instagram_posts set account_id = duplicate.keep_id where account_id = duplicate.duplicate_id;
    update public.instagram_sync_runs set account_id = duplicate.keep_id where account_id = duplicate.duplicate_id;
    update public.instagram_monthly_reports set account_id = duplicate.keep_id where account_id = duplicate.duplicate_id;
    update public.instagram_media set account_id = duplicate.keep_id where account_id = duplicate.duplicate_id;
    update public.instagram_daily_snapshots set account_id = duplicate.keep_id where account_id = duplicate.duplicate_id;
    update public.instagram_account_insights set account_id = duplicate.keep_id where account_id = duplicate.duplicate_id;
    delete from public.instagram_accounts where id = duplicate.duplicate_id;
  end loop;
end;
$$;

create unique index if not exists instagram_accounts_owner_identity_unique
  on public.instagram_accounts (owner_id, identity_key)
  where identity_key is not null and identity_key <> '';

commit;
