import { clock, dated, moscowNow, populated, type Day, type Schedule } from './schedule';

export interface ReminderSettings { daily: boolean; beforeEnd: boolean; end: boolean }
export const defaultReminders: ReminderSettings = { daily: true, beforeEnd: true, end: true };
export interface Reminder { id: number; at: number; title: string; body: string }

export function dayBounds(day: Day) {
  const pairs = populated(day);
  if (!pairs.length) return null;
  return {
    start: pairs.map(p => p.startTime).sort()[0],
    end: pairs.map(p => p.endTime).sort().at(-1)!,
    count: pairs.length,
  };
}

export function dayId(date: string, kind: number) { return Number(dated(date).replaceAll('-', '')) * 10 + kind; }

export function buildReminders(data: Schedule, settings: ReminderSettings, now = Date.now()): Reminder[] {
  const result = new Map<number, Reminder>();
  for (const week of data.weeks) for (const day of week.days) {
    const bounds = dayBounds(day);
    if (!day.date || !bounds) continue;
    const end = Date.parse(`${dated(day.date)}T${bounds.end}+03:00`);
    if (settings.beforeEnd && end - 900_000 > now) {
      const id = dayId(day.date, 1);
      result.set(id, { id, at: end - 900_000, title: 'До конца занятий 15 минут', body: `${data.instance} · Сегодня пары заканчиваются в ${clock(bounds.end)}.` });
    }
    if (settings.end && end > now) {
      const id = dayId(day.date, 2);
      result.set(id, { id, at: end, title: 'Занятия закончились', body: `${data.instance} · Последняя пара закончилась в ${clock(bounds.end)}.` });
    }
  }
  return [...result.values()].sort((a, b) => a.at - b.at);
}

export function dailySummary(data: Schedule, now = new Date()) {
  const date = moscowNow(now).date;
  const day = data.weeks.flatMap(w => w.days).find(d => d.date === date);
  if (!day) return null;
  const bounds = dayBounds(day);
  return { date, id: dayId(date, 3), title: 'Расписание на сегодня', body: bounds
    ? `${data.instance} · Пары с ${clock(bounds.start)} до ${clock(bounds.end)}.`
    : `${data.instance} · Сегодня занятий нет.` };
}
