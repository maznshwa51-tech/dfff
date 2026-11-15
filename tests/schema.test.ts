// يشغّل supabase/schema.sql على Postgres حقيقي (PGlite) ويتأكد إن RLS يمنع أي أحد يشوف بيانات غيره
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let db: PGlite;

// نسخة مبسطة من بيئة Supabase: auth.users و auth.uid() والأدوار
const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
insert into auth.users values ('${A}'), ('${B}');
`;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false); set role ${user ? "authenticated" : "anon"};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const schema = readFileSync("supabase/schema.sql", "utf8");
  await db.exec(schema);
  await db.exec(schema); // لازم يشتغل مرتين بدون أخطاء
  await db.exec("grant select, insert, update, delete on public.records to service_role; grant all on public.report_log to service_role;");
});

describe("schema.sql + RLS", () => {
  it("كل مستخدم يكتب ويقرأ بياناته فقط", async () => {
    await as(A, `insert into public.records (table_name, id, data) values ('weights', '2026-11-15', '{"id":"2026-11-15","date":"2026-11-15","kg":75}')`);
    await as(B, `insert into public.records (table_name, id, data) values ('weights', '2026-11-15', '{"id":"2026-11-15","date":"2026-11-15","kg":60}')`);
    const a = await as(A, "select user_id, data->>'kg' as kg from public.records");
    expect(a.rows).toEqual([{ user_id: A, kg: "75" }]);
    const b = await as(B, "select data->>'kg' as kg from public.records");
    expect(b.rows).toEqual([{ kg: "60" }]);
  });

  it("ما يقدر يكتب باسم غيره ولا يعدل أو يحذف بياناته", async () => {
    await expect(as(A, `insert into public.records (user_id, table_name, id, data) values ('${B}', 'steps', 'x', '{}')`)).rejects.toThrow(/row-level security/);
    const upd = await as(A, `update public.records set data = '{"kg":1}' where user_id = '${B}'`);
    expect(upd.affectedRows).toBe(0);
    const del = await as(A, `delete from public.records where user_id = '${B}'`);
    expect(del.affectedRows).toBe(0);
    const b = await as(B, "select data->>'kg' as kg from public.records");
    expect(b.rows).toEqual([{ kg: "60" }]);
  });

  it("الزائر بدون تسجيل دخول ما يشوف شي", async () => {
    await expect(as(null, "select * from public.records")).rejects.toThrow(/permission denied/);
  });

  it("upsert (المزامنة) يحدّث updated_at من السيرفر", async () => {
    const before = await as(A, "select updated_at from public.records where id = '2026-11-15'");
    await as(
      A,
      `insert into public.records (user_id, table_name, id, data, deleted, updated_at) values ('${A}', 'weights', '2026-11-15', '{"kg":74,"date":"2026-11-15"}', false, '2000-01-01')
       on conflict (user_id, table_name, id) do update set data = excluded.data, deleted = excluded.deleted`,
    );
    const after = await as(A, "select updated_at, data->>'kg' as kg from public.records where id = '2026-11-15'");
    expect(after.rows[0]).toMatchObject({ kg: "74" });
    expect(new Date((after.rows[0] as { updated_at: string }).updated_at).getTime()).toBeGreaterThan(new Date((before.rows[0] as { updated_at: string }).updated_at).getTime());
  });

  it("فلترة التاريخ للتقرير، وجدول التقارير للسيرفر فقط", async () => {
    const r = await as(A, "select id from public.records where table_name = 'weights' and data->>'date' >= '2026-11-10'");
    expect(r.rows).toHaveLength(1);
    await expect(as(A, "select * from public.report_log")).rejects.toThrow(/permission denied/);
    const pub = await db.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime'");
    expect(pub.rows).toEqual([{ tablename: "records" }]);
  });

  it("يقبل الشعارات ويرفض السجل الكبير جداً", async () => {
    await as(A, `insert into public.records (table_name, id, data) values ('logos', 'l1', '{"dataUrl":"data:image/png;base64,AAAA"}')`);
    const big = "x".repeat(700_000);
    await expect(as(A, `insert into public.records (table_name, id, data) values ('logos', 'l2', $1::jsonb)`, [JSON.stringify({ dataUrl: big })])).rejects.toThrow(/check constraint/);
  });

  it("يرفض أسماء جداول غريبة", async () => {
    await expect(as(A, `insert into public.records (table_name, id, data) values ('hack', 'x', '{}')`)).rejects.toThrow(/check constraint/);
  });
});
