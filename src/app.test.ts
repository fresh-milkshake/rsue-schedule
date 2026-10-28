import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { findToday, parseSchedule, type Schedule } from './schedule';
import { buildReminders, defaultReminders } from './reminder-plan';

const lesson = { id: 1, subject: 'Предмет', audience: '210', teacher: { name: 'Преподаватель' }, kind: { name: 'Лекция', shortName: 'л.' }, subgroup: { id: 0, name: '' } };
const schedule: Schedule = { instance: 'ИБ-312', kind: 'Group', weeks: [{ id: 9, name: '9', parity: 1, current: false, days: [{ id: 3, name: 'Среда', date: '28.10.2026', pairs: [
  { id: 1, startTime: '08:30:00', endTime: '10:00:00', lessons: [lesson] },
  { id: 2, startTime: '10:10:00', endTime: '11:40:00', lessons: [lesson] },
  { id: 3, startTime: '13:50:00', endTime: '15:20:00', lessons: [] },
] }] }] };

beforeEach(() => {
  vi.resetModules();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

it('validates the requested group and finds today by date', () => {
  expect(findToday(parseSchedule(schedule, 'ИБ-312'), '28.10.2026')).toEqual({ week: 0, day: 0 });
  expect(() => parseSchedule(schedule, 'УП-811')).toThrow();
});

it('filters teachers out of group search', async () => {
  const { parseGroups, filterGroups } = await import('./groups');
  const groups = parseGroups([{ id: 1, name: 'ИБ-312' }, { id: 2, name: 'доц.Иванов И.И.' }]);
  expect(filterGroups(groups, 'иб 312').map(group => group.name)).toEqual(['ИБ-312']);
});

it('remembers the chosen group on the next launch', async () => {
  let groups = await import('./groups');
  expect(groups.currentGroup).toBeNull();
  groups.selectGroup('ИБ-312');
  vi.resetModules();
  groups = await import('./groups');
  expect(groups.currentGroup).toBe('ИБ-312');
});

it('schedules reminders for the last occupied pair in Moscow time', () => {
  const reminders = buildReminders(schedule, defaultReminders, Date.parse('2026-10-28T05:00:00Z'));
  expect(reminders.map(reminder => new Date(reminder.at).toISOString())).toEqual(['2026-10-28T08:25:00.000Z', '2026-10-28T08:40:00.000Z']);
});

it('rejects a cache belonging to another group', async () => {
  const { readCache } = await import('./data');
  localStorage.setItem('rhythm.schedule.v2.УП-811', JSON.stringify({ data: schedule, savedAt: new Date().toISOString() }));
  expect(readCache('УП-811')).toBeNull();
});
