"use client";

// يدير المزامنة في المتصفح: بعد كل تغيير، لما يرجع النت، لما تفتح التطبيق،
// ولما جهاز ثاني يغيّر شي (Realtime)، وكل دقيقة احتياطاً

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaults } from "./bootstrap";
import { getDb, getMeta } from "./db";
import { onLocalChange } from "./repo";
import { syncOnce, type RemoteAdapter } from "./sync";
import { supabaseAdapter } from "./supabase";

export type SyncState = "local" | "idle" | "syncing" | "offline" | "error";
export interface SyncStatus {
  state: SyncState;
  lastSync?: number;
}

class SyncManager {
  status: SyncStatus = { state: "local" };
  private listeners = new Set<() => void>();
  private remote: RemoteAdapter | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cleanup: (() => void)[] = [];
  private channel: RealtimeChannel | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getStatus = () => this.status;

  private set(s: Partial<SyncStatus>) {
    this.status = { ...this.status, ...s };
    for (const fn of this.listeners) fn();
  }

  start(sb: SupabaseClient, userId: string) {
    this.stop();
    this.remote = supabaseAdapter(sb, userId);
    this.set({ state: "idle" });
    const req = () => this.request();
    const onVis = () => document.visibilityState === "visible" && req();
    const off = () => this.set({ state: "offline" });
    window.addEventListener("online", req);
    window.addEventListener("offline", off);
    document.addEventListener("visibilitychange", onVis);
    const unsub = onLocalChange(req);
    const iv = setInterval(req, 60_000);
    this.cleanup.push(() => {
      window.removeEventListener("online", req);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
      clearInterval(iv);
    });
    // تغييرات من أجهزة ثانية مباشرة
    this.channel = sb
      .channel(`records-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: `user_id=eq.${userId}` }, () => this.request(300))
      .subscribe();
    const ch = this.channel;
    this.cleanup.push(() => void sb.removeChannel(ch));
  }

  stop() {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    this.channel = null;
    this.remote = null;
    if (this.timer) clearTimeout(this.timer);
    this.set({ state: "local" });
  }

  /** مزامنة بعد مهلة قصيرة (تجمع التغييرات المتتالية) */
  request(delay = 800) {
    if (!this.remote) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.runNow(), delay);
  }

  async runNow(): Promise<void> {
    if (!this.remote) return;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          this.set({ state: "offline" });
          break;
        }
        this.set({ state: "syncing" });
        try {
          const db = getDb();
          await syncOnce(db, this.remote!);
          // جهاز جديد أو حساب جديد: نضيف الافتراضيات بعد أول سحب ناجح
          if (!(await getMeta(db, "defaultsSeeded"))) {
            await ensureDefaults(db);
            this.again = true;
          }
          this.set({ state: "idle", lastSync: Date.now() });
        } catch (e) {
          console.warn("sync failed", e);
          this.set({ state: navigator.onLine ? "error" : "offline" });
          break;
        }
      } while (this.again && this.remote);
    })();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }
}

export const syncManager = new SyncManager();
