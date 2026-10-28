import '@fontsource/doto/latin-500.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource-variable/golos-text';
import './style.css';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { loadSchedule, readCache, type SavedSchedule } from './data';
import { icon } from './icons';
import { findToday, moscowNow } from './schedule';
import { button, dayView, escape, settingsView, weekView } from './views';
import { appMetadata } from './app-meta';
import { initializeNotifications, notificationAction, observeNotifications, setReminder, syncNotifications, clearGroupNotifications } from './notifications';
import { currentGroup, selectGroup } from './groups';
import { picker, openPicker, pickerView, pickerResults } from './group-picker';
import type { ReminderSettings } from './reminder-plan';
import { applyPreferences, updatePreferences, preferences, type Preferences } from './preferences';

const root = document.querySelector<HTMLDivElement>('#app')!;
let saved: SavedSchedule | null = readCache(currentGroup);
let selected = saved ? findToday(saved.data, moscowNow().date) : { week: 0, day: 0 };
let page: 'day' | 'week' | 'settings' = 'day';
let loading = false;
let offline = false;
let message = '';
let version = 0;
let lastVisibleDate = moscowNow().date;

function syncTime() {
  return saved ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(saved.savedAt)) : 'Не загружено';
}

function render() {
  if (picker.open || !currentGroup) { root.innerHTML = pickerView(); return; }
  const focused = document.activeElement;
  const focusKey = focused instanceof HTMLButtonElement && root.contains(focused) ? Object.entries(focused.dataset) : null;
  root.innerHTML = `<div class="app-shell" data-page="${page}" data-status="${message ? 'error' : 'ready'}"><header class="group-line"><span class="mono">РАСПИСАНИЕ / <span class="bright">${escape(currentGroup)}</span></span>${button('refresh', 'Обновить расписание', 'refresh', loading ? 'disabled' : '')}</header><main id="main">${page === 'settings' ? settingsView(syncTime()) : saved?.data.weeks.length ? page === 'day' ? dayView(saved.data, selected) : weekView(saved.data, selected.week) : `<div class="initial-state"><h1>${loading ? 'Загрузка расписания' : saved ? 'Расписание пока не опубликовано' : 'Нет расписания'}</h1><p>${loading ? 'Подключение к rasp.rsue.ru…' : 'Подключитесь к сети и обновите расписание.'}</p>${!loading ? '<button class="outline-button" data-action="refresh">ПОВТОРИТЬ</button>' : ''}</div>`}<div class="sync-footer" role="status" aria-live="polite"><span class="mono ${offline || message ? 'status-warning' : ''}">${loading ? 'ОБНОВЛЕНИЕ…' : escape(message || (offline ? 'БЕЗ СЕТИ · СОХРАНЁННАЯ КОПИЯ' : saved ? 'ОБНОВЛЕНО' : 'НЕТ ДАННЫХ'))}</span>${saved ? `<span class="mono">${syncTime()}</span>` : ''}</div></main><nav class="bottom-nav" aria-label="Главная навигация">${(['day', 'week', 'settings'] as const).map((item, i) => `<button data-action="page" data-page="${item}" class="nav-item ${page === item ? 'active' : ''}" ${page === item ? 'aria-current="page"' : ''}>${icon(item)}<span class="mono">${['ДЕНЬ', 'НЕДЕЛЯ', 'НАСТРОЙКИ'][i]}</span></button>`).join('')}</nav></div>`;
  if (focusKey?.length) [...root.querySelectorAll<HTMLButtonElement>('button[data-action]')].find(b => focusKey.every(([key, value]) => b.dataset[key] === value))?.focus({ preventScroll: true });
}

async function refresh() {
  if (loading || !currentGroup || picker.open) return;
  const requestGroup = currentGroup;
  loading = true;
  message = '';
  render();
  const requestVersion = version;
  const previousWeek = saved?.data.weeks[selected.week]?.id;
  const previousDate = saved?.data.weeks[selected.week]?.days[selected.day]?.date;
  try {
    const result = await loadSchedule(requestGroup);
    if (currentGroup !== requestGroup) return;
    const initial = !saved;
    saved = result;
    offline = false;
    message = result.persisted ? '' : 'НЕ УДАЛОСЬ СОХРАНИТЬ КОПИЮ';
    if (initial) selected = findToday(saved.data, moscowNow().date);
    else if (requestVersion === version) {
      const week = saved.data.weeks.findIndex(w => w.id === previousWeek);
      const day = week >= 0 ? saved.data.weeks[week].days.findIndex(d => d.date === previousDate) : -1;
      selected = week >= 0 && day >= 0 ? { week, day } : findToday(saved.data, moscowNow().date);
    } else {
      selected.week = Math.min(selected.week, saved.data.weeks.length - 1);
      selected.day = Math.min(selected.day, saved.data.weeks[selected.week].days.length - 1);
    }
  } catch {
    if (currentGroup !== requestGroup) return;
    offline = true;
    message = saved ? 'БЕЗ СВЯЗИ · СОХРАНЁННАЯ КОПИЯ' : 'НЕТ СВЯЗИ С УНИВЕРСИТЕТОМ';
  } finally {
    if (currentGroup === requestGroup) {
      loading = false;
      render();
      if (saved && !picker.open) void syncNotifications(saved.data);
    }
  }
}

async function showGroups() {
  const operation = openPicker(Boolean(currentGroup), currentGroup ?? '');
  render();
  window.scrollTo(0, 0);
  await operation;
  if (picker.open) root.querySelector('#group-results')!.innerHTML = pickerResults();
}

async function confirmGroup() {
  if (picker.busy || !picker.groups.some(group => group.name === picker.selected)) return;
  picker.busy = true;
  picker.error = '';
  render();
  try {
    let result: SavedSchedule & { persisted: boolean };
    try { result = await loadSchedule(picker.selected); offline = false; }
    catch {
      const cached = readCache(picker.selected);
      if (!cached) throw new Error('Нет связи с университетом. Попробуйте ещё раз.');
      result = { ...cached, persisted: true };
      offline = true;
    }
    if (currentGroup !== picker.selected) await clearGroupNotifications();
    selectGroup(picker.selected);
    saved = result;
    selected = findToday(result.data, moscowNow().date);
    page = 'day';
    picker.open = false;
    loading = false;
    message = offline ? 'БЕЗ СЕТИ · СОХРАНЁННАЯ КОПИЯ' : result.persisted ? '' : 'НЕ УДАЛОСЬ СОХРАНИТЬ КОПИЮ';
    version++;
    render();
    window.scrollTo(0, 0);
    await initializeNotifications();
    void syncNotifications(result.data);
  } catch {
    picker.error = 'Не удалось выбрать группу. Проверьте сеть и повторите.';
    if (saved && currentGroup) void syncNotifications(saved.data);
  } finally { picker.busy = false; render(); }
}

root.addEventListener('input', event => {
  const target = event.target as HTMLInputElement;
  if (target.id !== 'group-query') return;
  picker.query = target.value;
  picker.limit = 40;
  root.querySelector('#group-results')!.innerHTML = pickerResults();
});

root.addEventListener('click', async event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'change-group' || action === 'retry-groups') { void showGroups(); return; }
  if (action === 'cancel-group') { if (currentGroup && !picker.busy) { picker.open = false; render(); } return; }
  if (action === 'choose-group') {
    if (picker.busy) return;
    picker.selected = target.dataset.group ?? '';
    picker.error = '';
    render();
    return;
  }
  if (action === 'more-groups') { picker.limit += 40; root.querySelector('#group-results')!.innerHTML = pickerResults(); return; }
  if (action === 'confirm-group') { await confirmGroup(); return; }
  if (action === 'author') {
    if (isTauri()) {
      event.preventDefault();
      try { await openUrl(appMetadata.authorUrl); }
      catch { message = 'НЕ УДАЛОСЬ ОТКРЫТЬ GITHUB'; render(); }
    }
    return;
  }
  if (action === 'appearance') {
    const key = target.dataset.key as keyof Preferences;
    const value = key === 'teachers' ? !preferences.teachers : target.dataset.value;
    try { updatePreferences({ [key]: value }); message = ''; }
    catch { message = 'НЕ УДАЛОСЬ СОХРАНИТЬ НАСТРОЙКИ'; }
    render();
    return;
  }
  if (action === 'refresh') { await refresh(); return; }
  if (action === 'toggle-reminder') { await setReminder(target.dataset.key as keyof ReminderSettings); return; }
  if (action === 'notification') { await notificationAction(target.dataset.operation as Parameters<typeof notificationAction>[0]); return; }
  if (action === 'source') {
    const source = `https://rasp.rsue.ru/?instance=${encodeURIComponent(currentGroup ?? '')}`;
    try {
      if (isTauri()) await openUrl(source);
      else window.open(source, '_blank', 'noopener,noreferrer');
    } catch { message = 'НЕ УДАЛОСЬ ОТКРЫТЬ ИСТОЧНИК'; render(); }
    return;
  }
  if (action === 'page') page = target.dataset.page as typeof page;
  else if (!saved?.data.weeks.length) return;
  else if (action === 'today') { selected = findToday(saved.data, moscowNow().date); page = 'day'; }
  else if (action === 'previous' || action === 'next') {
    selected.week = Math.max(0, Math.min(saved.data.weeks.length - 1, selected.week + (action === 'next' ? 1 : -1)));
    selected.day = Math.min(selected.day, saved.data.weeks[selected.week].days.length - 1);
  } else if (action === 'select-day') { selected.day = Number(target.dataset.day); page = 'day'; }
  version++;
  render();
  if (action === 'page' || action === 'select-day') window.scrollTo(0, 0);
});
observeNotifications(() => { if (page === 'settings') render(); });
window.addEventListener('online', () => void refresh());
window.addEventListener('offline', () => { offline = true; message = ''; render(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!currentGroup || picker.open) return;
  void initializeNotifications();
  if (!saved || Date.now() - Date.parse(saved.savedAt) > 5 * 60 * 1000) void refresh();
  else { render(); void syncNotifications(saved.data); }
});
setInterval(() => {
  if (document.visibilityState !== 'visible' || picker.open || !currentGroup) return;
  const date = moscowNow().date;
  if (saved && lastVisibleDate !== date) { lastVisibleDate = date; void syncNotifications(saved.data); }
  if (!loading) render();
}, 60_000);
applyPreferences();
render();
if (!currentGroup) void showGroups();
else { void initializeNotifications(); void refresh(); }
