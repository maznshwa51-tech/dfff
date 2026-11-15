-- ============================================================
-- لياقتي: قاعدة البيانات في Supabase
-- انسخ هذا الملف كامل والصقه في Supabase → SQL Editor → Run
-- ============================================================

-- جدول واحد لكل البيانات: كل صف = سجل واحد (أكلة، وزن، تمرين...)
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text        not null,
  id         text        not null check (char_length(id) between 1 and 100),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, table_name, id)
);

-- أسماء الجداول المسموحة (ينحدّث كل مرة تشغّل الملف، عشان الإضافات الجديدة مثل logos)
alter table public.records drop constraint if exists records_table_name_check;
alter table public.records add constraint records_table_name_check check (table_name in (
  'categories','foods','entries','weights','waists','steps',
  'sessions','workoutTypes','dayTypes','favorites','settings','logos'));
-- حد أقصى لحجم السجل الواحد (الشعار صورة صغيرة)
alter table public.records drop constraint if exists records_data_size_check;
alter table public.records add constraint records_data_size_check check (pg_column_size(data) < 600000);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);
create index if not exists records_user_table_date_idx on public.records (user_id, table_name, (data ->> 'date'));

-- وقت التعديل يحدده السيرفر دائماً (عشان المزامنة ما تتأثر بساعة الجوال)
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- ============ Row Level Security: محد يشوف بياناتك غيرك ============
alter table public.records enable row level security;
alter table public.records force row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.records for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.records for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;
-- السيرفر (التقرير التلقائي) يحتاج يقرأ البيانات
grant select, insert, update, delete on public.records to service_role;

-- ============ سجل التقارير المرسلة (للسيرفر فقط) ============
create table if not exists public.report_log (
  user_id  uuid not null references auth.users (id) on delete cascade,
  date     date not null,
  channels text,
  sent_at  timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.report_log enable row level security;
-- بدون policies: ما يقدر يوصله إلا السيرفر (service role)
revoke all on public.report_log from anon, authenticated;
grant select, insert, update, delete on public.report_log to service_role;

-- ============ المزامنة المباشرة بين الأجهزة (Realtime) ============
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
    ) then
      alter publication supabase_realtime add table public.records;
    end if;
  end if;
end $$;
