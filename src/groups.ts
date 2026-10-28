import { invoke, isTauri } from '@tauri-apps/api/core';

export interface Group { id: number; name: string }
const selectionKey = 'rhythm.group.v1';
const listKey = 'rhythm.groups.v1';
export function isGroupName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[А-ЯЁA-Z0-9 ()]+-\d+[А-ЯЁа-яёA-Za-z0-9 -]*$/.test(value);
}
export function parseGroups(value: unknown): Group[] {
  if (!Array.isArray(value)) throw new Error('Не удалось прочитать список групп');
  const groups = new Map<string, Group>();
  for (const item of value) {
    if (item && Number.isInteger(item.id) && isGroupName(item.name)) groups.set(item.name, { id: item.id, name: item.name });
  }
  if (!groups.size) throw new Error('Список групп пуст');
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
}
export function readGroup(): string | null {
  try { const value = localStorage.getItem(selectionKey); return isGroupName(value) ? value : null; }
  catch { return null; }
}
export let currentGroup = readGroup();
export function selectGroup(name: string) {
  if (!isGroupName(name)) throw new Error('Некорректная группа');
  localStorage.setItem(selectionKey, name);
  currentGroup = name;
}
export function cachedGroups(): Group[] {
  try { return parseGroups(JSON.parse(localStorage.getItem(listKey) ?? 'null')); }
  catch { return []; }
}
export async function loadGroups(): Promise<Group[]> {
  let response: unknown;
  if (isTauri()) response = await invoke('fetch_groups');
  else {
    const base = import.meta.env.DEV ? '/api/v1/' : 'https://rasp-api.rsue.ru/api/v1/';
    const result = await fetch(`${base}schedule/search/`, { signal: AbortSignal.timeout(20000) });
    if (!result.ok) throw new Error('Список групп недоступен');
    response = await result.json();
  }
  const groups = parseGroups(response);
  try { localStorage.setItem(listKey, JSON.stringify(groups)); } catch { /* Caching is optional. */ }
  return groups;
}
export function filterGroups(groups: Group[], query: string) {
  const normalize = (value: string) => value.toLocaleUpperCase('ru').replace(/[\s–—-]/g, '');
  return groups.filter(group => normalize(group.name).includes(normalize(query)));
}
