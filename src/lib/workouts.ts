// جدول التمرين، قائمة الإنجاز، ونسبة الالتزام والسلسلة

import { addDays, lastNDays } from "./dates";
import { scheduledType } from "./targets";
import type { Session, Settings, WorkoutType } from "./types";

/** تمرين اليوم: المسجل، أو حسب الجدول إذا ما سجلت شي */
export function plannedFor(date: string, s: Settings, session?: Session): string {
  return session?.type ?? scheduledType(date, s);
}

/** جلسة جديدة فاضية حسب الجدول */
export function newSession(date: string, type: string, s: Settings, kind?: WorkoutType["kind"]): Session {
  const rounds = kind === "rounds" ? Math.max(1, s.homeRounds) : 0;
  return {
    id: date,
    date,
    type,
    done: false,
    rounds: rounds ? Array(rounds).fill(false) : undefined,
    pushups: rounds ? Array(rounds).fill(null) : undefined,
    updatedAt: Date.now(),
  };
}

/** تأشير جولة: التمرين يصير منجز إذا خلصت كل الجولات */
export function toggleRound(session: Session, i: number): Session {
  const rounds = [...(session.rounds ?? [])];
  rounds[i] = !rounds[i];
  return { ...session, rounds, done: rounds.length > 0 && rounds.every(Boolean), updatedAt: Date.now() };
}

export interface Compliance {
  planned: number;
  done: number;
  /** نسبة مئوية 0-100، أو null إذا ما فيه تمارين مجدولة */
  pct: number | null;
}

/**
 * نسبة التمارين اللي خلصتها من المجدولة في الفترة.
 * اليوم ما ينحسب ضدك إذا لسا ما خلصت تمرينه (اليوم ما انتهى).
 */
export function compliance(days: string[], today: string, s: Settings, sessions: Map<string, Session>): Compliance {
  let planned = 0;
  let done = 0;
  for (const d of days) {
    if (d > today) continue;
    const ses = sessions.get(d);
    const type = plannedFor(d, s, ses);
    if (type === "rest") continue;
    if (ses?.done) {
      planned++;
      done++;
    } else if (d < today) {
      planned++;
    }
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : null };
}

/**
 * سلسلة التمارين المتتالية 🔥: كل تمرين مجدول خلصته يزيدها،
 * أيام الراحة ما تقطعها، وتمرين مجدول ما خلصته يقطعها.
 */
export function workoutStreak(today: string, s: Settings, sessions: Map<string, Session>, maxDays = 400): number {
  let n = 0;
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(today, -i);
    const ses = sessions.get(d);
    const type = plannedFor(d, s, ses);
    if (ses?.done && type !== "rest") n++;
    else if (type === "rest") continue;
    else if (d === today) continue; // اليوم لسا ما خلص
    else break;
  }
  return n;
}

export function weekAndMonth(today: string, s: Settings, sessions: Map<string, Session>) {
  return {
    week: compliance(lastNDays(today, 7), today, s, sessions),
    month: compliance(lastNDays(today, 30), today, s, sessions),
    streak: workoutStreak(today, s, sessions),
  };
}
