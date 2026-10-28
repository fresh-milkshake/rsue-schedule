import { invoke, isTauri } from '@tauri-apps/api/core';
import { parseSchedule, type Schedule } from './schedule';

const key = (group: string) => `rhythm.schedule.v2.${group}`;
export interface SavedSchedule { data: Schedule; savedAt: string }

export function readCache(group: string | null): SavedSchedule | null {
  if (!group) return null;
  try {
    const value = JSON.parse(localStorage.getItem(key(group)) ?? 'null');
    if (!value || !Number.isFinite(Date.parse(value.savedAt))) return null;
    return { data: parseSchedule(value.data, group), savedAt: value.savedAt };
  } catch { return null; }
}

export async function loadSchedule(group: string): Promise<SavedSchedule & { persisted: boolean }> {
  let response: unknown;
  if (isTauri()) {
    response = await invoke('fetch_schedule', { group });
  } else {
    // The dev server proxies this API; production browser preview uses the public API.
    const base = import.meta.env.DEV ? '/api/v1/' : 'https://rasp-api.rsue.ru/api/v1/';
    const result = await fetch(`${base}schedule/lessons/${encodeURIComponent(group)}/`, { signal: AbortSignal.timeout(20000) });
    if (!result.ok) throw new Error('Сервер расписания недоступен');
    response = await result.json();
  }
  const saved = { data: parseSchedule(response, group), savedAt: new Date().toISOString() };
  let persisted = true;
  try { localStorage.setItem(key(group), JSON.stringify(saved)); } catch { persisted = false; }
  return { ...saved, persisted };
}
