export interface Lesson {
  id: number;
  subject: string;
  teacher: { name: string };
  subgroup: { id: number; name: string };
  kind: { name: string; shortName: string };
  audience: string;
}
export interface Pair {
  id: number;
  startTime: string;
  endTime: string;
  lessons: Lesson[];
}
export interface Day {
  id: number;
  name: string;
  date: string | null;
  pairs: Pair[];
}
export interface Week {
  id: number;
  name: string;
  parity: number;
  current: boolean;
  days: Day[];
}
export interface Schedule {
  instance: string;
  kind: string;
  weeks: Week[];
}

/** Validate remote data and the persisted cache before either reaches the UI. */
export function parseSchedule(value: unknown, expectedGroup?: string): Schedule {
  const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const text = (v: unknown): v is string => typeof v === 'string';
  const time = (v: unknown) => text(v) && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(v);
  if (!object(value) || !text(value.instance) || !value.instance || (expectedGroup !== undefined && value.instance !== expectedGroup) || value.kind !== 'Group' || !Array.isArray(value.weeks)) {
    throw new Error('Не удалось прочитать расписание группы');
  }
  for (const week of value.weeks) {
    if (!object(week) || !Number.isInteger(week.id) || !text(week.name) || typeof week.current !== 'boolean' || ![1, 2].includes(Number(week.parity)) || !Array.isArray(week.days) || !week.days.length) throw new Error('Некорректная неделя');
    for (const day of week.days) {
      if (!object(day) || !Number.isInteger(day.id) || !text(day.name) || !(day.date === null || (text(day.date) && /^\d{2}\.\d{2}\.\d{4}$/.test(day.date))) || !Array.isArray(day.pairs)) throw new Error('Некорректный день');
      for (const pair of day.pairs) {
        if (!object(pair) || !Number.isInteger(pair.id) || !time(pair.startTime) || !time(pair.endTime) || !Array.isArray(pair.lessons)) throw new Error('Некорректное время пары');
        for (const lesson of pair.lessons) {
          if (!object(lesson) || !Number.isInteger(lesson.id) || !text(lesson.subject) || !text(lesson.audience) || !object(lesson.teacher) || !text(lesson.teacher.name) || !object(lesson.kind) || !text(lesson.kind.name) || !text(lesson.kind.shortName) || !object(lesson.subgroup) || !Number.isInteger(lesson.subgroup.id) || !text(lesson.subgroup.name)) throw new Error('Некорректное занятие');
        }
      }
    }
  }
  return value as unknown as Schedule;
}

export const shortDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
export const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const clock = (time: string) => time.slice(0, 5);
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const dated = (date: string) => date.split('.').reverse().join('-');

export function moscowNow(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${p.day}.${p.month}.${p.year}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

export function dateLabel(date: string | null) {
  if (!date) return 'По дням недели';
  const [day, month] = date.split('.').map(Number);
  return `${day} ${months[month - 1]}`;
}

export function findToday(data: Schedule, date: string): { week: number; day: number } {
  if (!data.weeks.length) return { week: 0, day: 0 };
  for (const [week, item] of data.weeks.entries()) {
    const day = item.days.findIndex(d => d.date === date);
    if (day >= 0) return { week, day };
    // Sunday belongs to the same calendar week even though the API only lists Mon–Sat.
    const first = item.days.find(d => d.date)?.date;
    if (first) {
      const delta = (Date.parse(dated(date)) - Date.parse(dated(first))) / 86400000;
      if (delta >= 0 && delta <= 6) return { week, day: Math.min(delta, item.days.length - 1) };
    }
  }
  const next = data.weeks.findIndex(w => w.days.some(d => d.date && dated(d.date) >= dated(date)));
  return { week: next < 0 ? data.weeks.length - 1 : next, day: 0 };
}

export function populated(day: Day) { return day.pairs.filter(p => p.lessons.length > 0); }

export function pairState(day: Day, pair: Pair, now = moscowNow()): 'past' | 'live' | 'future' {
  if (!day.date) return 'future';
  if (dated(day.date) < dated(now.date)) return 'past';
  if (dated(day.date) > dated(now.date)) return 'future';
  if (now.minute >= minutes(pair.endTime)) return 'past';
  return now.minute >= minutes(pair.startTime) ? 'live' : 'future';
}

export function nextPair(data: Schedule, now = moscowNow()) {
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (!day.date || dated(day.date) < dated(now.date)) continue;
      for (const pair of populated(day)) {
        if (pairState(day, pair, now) !== 'past') return { day, pair };
      }
    }
  }
  return null;
}

export function pluralPairs(count: number) {
  const n = count % 100;
  return `${count} ${n > 10 && n < 20 ? 'пар' : count % 10 === 1 ? 'пара' : [2, 3, 4].includes(count % 10) ? 'пары' : 'пар'}`;
}
