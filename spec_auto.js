-- =====================================================================
-- MEP SPECIFICATIONS – AUTOMATION, PHASE 1
-- Run ONCE in the pump / spec Supabase project (SQL Editor). Safe to re-run.
-- Needs spec_platform_migration.sql (already run): uses spec_is_engineer(),
-- spec_lib_can_edit() and spec_item_history from it.
--
--   spec_relations          section → related section      ({{AUTO:RELATED}})
--   spec_standards          central standards register     ({{AUTO:STANDARDS}})
--   spec_section_standards  section → standards it cites
--   spec_blocks             common text written once        ({{>KEY}})
-- No existing table or data is changed by this file.
-- =====================================================================

create table if not exists public.spec_relations (
  id            bigint generated always as identity primary key,
  from_num      text not null,                 -- e.g. '21 0500'
  to_num        text not null,                 -- e.g. '21 0548' or '07 8400'
  label         text,                          -- title, only for sections not in the library
  include_when  text,                          -- optional option condition
  sort          integer not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique (from_num, to_num)
);
create index if not exists spec_relations_from_idx on public.spec_relations(from_num);

create table if not exists public.spec_standards (
  code          text primary key,              -- e.g. 'NFPA 13'
  title         text not null,
  edition       text,                          -- default edition / year
  editions      jsonb not null default '{}'::jsonb,   -- per country: {"UAE":"2019","KSA":"2016"}
  org           text,
  notes         text,
  sort          integer not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create table if not exists public.spec_section_standards (
  id            bigint generated always as identity primary key,
  section_num   text not null,
  code          text not null,
  include_when  text,
  sort          integer not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique (section_num, code)
);
create index if not exists spec_secstd_sec_idx on public.spec_section_standards(section_num);

create table if not exists public.spec_blocks (
  key           text primary key,              -- e.g. 'COMMON.QUALITY_ASSURANCE'
  title         text,
  body          text not null default '',      -- library markup lines: - text / [if:key] - text
  sort          integer not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

-- History: the previous version of every edited or deleted row goes to spec_item_history.
create or replace function public.spec_auto_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v jsonb := to_jsonb(old); k text;
begin
  k := case tg_table_name
         when 'spec_relations' then (v->>'from_num') || ' > ' || (v->>'to_num')
         when 'spec_section_standards' then (v->>'section_num') || ' : ' || (v->>'code')
         when 'spec_blocks' then v->>'key'
         else v->>'code' end;
  if tg_op = 'DELETE' then
    insert into public.spec_item_history(tbl, code, old_row, action, changed_by) values (tg_table_name, k, v, 'delete', null);
    return old;
  end if;
  if (to_jsonb(new) - 'updated_at' - 'updated_by') is distinct from (v - 'updated_at' - 'updated_by') then
    insert into public.spec_item_history(tbl, code, old_row, action, changed_by) values (tg_table_name, k, v, 'update', new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['spec_relations','spec_standards','spec_section_standards','spec_blocks'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_audit', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.spec_auto_audit()', 'trg_' || t || '_audit', t);
  end loop;
end $$;

-- Row level security: active engineers read; Admin / Lead / Associate write.
-- Link rows (relations, section standards) can be deleted by editors; the
-- register and common text are deactivated instead (active = false).
alter table public.spec_relations          enable row level security;
alter table public.spec_standards          enable row level security;
alter table public.spec_section_standards  enable row level security;
alter table public.spec_blocks             enable row level security;

do $$
declare r record; t text;
begin
  for r in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('spec_relations','spec_standards','spec_section_standards','spec_blocks')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach t in array array['spec_relations','spec_standards','spec_section_standards','spec_blocks'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.spec_is_engineer())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.spec_lib_can_edit())', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.spec_lib_can_edit()) with check (public.spec_lib_can_edit())', t || '_upd', t);
  end loop;
  foreach t in array array['spec_relations','spec_section_standards'] loop
    execute format('create policy %I on public.%I for delete to authenticated using (public.spec_lib_can_edit())', t || '_del', t);
  end loop;
end $$;

revoke all on public.spec_relations, public.spec_standards, public.spec_section_standards, public.spec_blocks from anon;

select 'automation tables ready' as status,
       (select count(*) from public.spec_relations)         as related_links,
       (select count(*) from public.spec_standards)         as standards,
       (select count(*) from public.spec_section_standards) as section_standards,
       (select count(*) from public.spec_blocks)            as common_text;
