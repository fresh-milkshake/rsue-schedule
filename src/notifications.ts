import { invoke, isTauri } from '@tauri-apps/api/core';
import { createChannel, Importance, pending, cancel, Schedule as NotificationSchedule } from '@tauri-apps/plugin-notification';
import type { Options } from '@tauri-apps/plugin-notification';
import type { Schedule } from './schedule';
import { buildReminders, dailySummary, defaultReminders, type ReminderSettings } from './reminder-plan';

const settingsKey = 'rhythm.reminders.v1';
const summaryKey = 'rhythm.summary-date.v1';
const channelId = 'schedule';
export interface ReminderAccess { android: boolean; exact: boolean; enabled: boolean; safeTop?: number; safeBottom?: number }
export let reminderAccess: ReminderAccess = { android: false, exact: false, enabled: false };
export let notificationStatus = '';
export let scheduledCount = 0;
export let notificationBusy = false;
let lastSchedule: Schedule | null = null;
let queue: Promise<void> = Promise.resolve();
let onChange = () => {};
let scheduledExact: boolean | null = null;

export function readReminderSettings(): ReminderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? '{}');
    return Object.fromEntries(Object.entries(defaultReminders).map(([key, fallback]) => [key, typeof saved[key] === 'boolean' ? saved[key] : fallback])) as unknown as ReminderSettings;
  } catch { return { ...defaultReminders }; }
}
export let reminderSettings = readReminderSettings();

export function observeNotifications(callback: () => void) { onChange = callback; }

async function access() {
  if (isTauri()) reminderAccess = await invoke<ReminderAccess>('reminder_access', { action: 'status' });
  if (typeof document !== 'undefined' && reminderAccess.android) {
    document.documentElement.style.setProperty('--native-safe-top', `${reminderAccess.safeTop ?? 0}px`);
    document.documentElement.style.setProperty('--native-safe-bottom', `${reminderAccess.safeBottom ?? 0}px`);
  }
}

async function requestNativePermission() {
  const state = await invoke<{ permissionState: string }>('plugin:notification|check_permissions');
  if (state.permissionState !== 'granted') await invoke('plugin:notification|request_permission');
  await access();
}

// Use the plugin's awaitable native batch command so failures do not mark a summary as sent.
async function deliver(notifications: Options[]) {
  // Android's batch API persists sourceJson, not the parsed Notification object.
  // Without this field AlarmManager fires initially but pending()/boot restoration lose the plan.
  // Plugin 2.8.0 accepts icon options per notification; its Rust startup config is unit ().
  const payload = notifications.map(options => {
    const notification = { ...options, icon: 'ic_stat_rhythm', iconColor: '#FFFFFF' };
    return { ...notification, sourceJson: JSON.stringify(notification) };
  });
  await invoke('plugin:notification|batch', { notifications: payload });
}

async function synchronize(data: Schedule) {
  if (!isTauri()) return;
  await access();
  if (!reminderAccess.android) return;
  if (!reminderAccess.enabled) {
    notificationStatus = 'Уведомления запрещены в Android';
    return;
  }
  await createChannel({ id: channelId, name: 'Расписание', importance: Importance.Default, description: 'Время занятий и окончание учебного дня' });
  const existing = await pending();
  const plan = buildReminders(data, reminderSettings);
  const desired = new Map(plan.map(r => [r.id, r]));
  // Keep unchanged alarms. Cancel only removed or modified ones, never a delivered notice.
  const changed = existing.filter(p => {
    const replacement = desired.get(p.id);
    return scheduledExact !== reminderAccess.exact || !replacement || new Date(p.schedule?.at?.date ?? 0).getTime() !== replacement.at || p.body !== replacement.body;
  });
  if (changed.length) await cancel(changed.map(p => p.id));
  const unchanged = new Set(existing.filter(p => !changed.includes(p)).map(p => p.id));
  const additions = plan.filter(r => !unchanged.has(r.id));
  if (additions.length) await deliver(additions.map(r => ({ id: r.id, title: r.title, body: r.body, channelId, autoCancel: true, schedule: NotificationSchedule.at(new Date(r.at), false, true) })));
  scheduledCount = plan.length;
  scheduledExact = reminderAccess.exact;
  notificationStatus = '';
  const summary = reminderSettings.daily ? dailySummary(data) : null;
  const groupSummaryKey = `${summaryKey}.${data.instance}`;
  if (summary && localStorage.getItem(groupSummaryKey) !== summary.date) {
    await deliver([{ id: summary.id, title: summary.title, body: summary.body, channelId, autoCancel: true }]);
    localStorage.setItem(groupSummaryKey, summary.date);
  }
}

export function clearGroupNotifications() {
  lastSchedule = null;
  queue = queue.catch(() => {}).then(async () => {
    if (isTauri()) {
      const existing = await pending();
      if (existing.length) await cancel(existing.map(item => item.id));
    }
    scheduledCount = 0;
    scheduledExact = null;
  });
  return queue;
}

export function syncNotifications(data: Schedule) {
  lastSchedule = data;
  queue = queue.then(async () => {
    notificationBusy = true;
    try { await synchronize(data); }
    catch { notificationStatus = 'Не удалось обновить уведомления. Повторите синхронизацию.'; }
    finally { notificationBusy = false; onChange(); }
  });
  return queue;
}

export async function initializeNotifications() {
  if (!isTauri()) return;
  try {
    await access();
    if (reminderAccess.android && !reminderAccess.enabled && !localStorage.getItem('rhythm.notification-prompt.v1')) {
      localStorage.setItem('rhythm.notification-prompt.v1', '1');
      await requestNativePermission();
    }
    if (lastSchedule) await syncNotifications(lastSchedule);
  } catch { notificationStatus = 'Не удалось проверить разрешения Android'; }
  onChange();
}

export async function setReminder(key: keyof ReminderSettings) {
  reminderSettings = { ...reminderSettings, [key]: !reminderSettings[key] };
  try { localStorage.setItem(settingsKey, JSON.stringify(reminderSettings)); }
  catch { notificationStatus = 'Не удалось сохранить настройки'; onChange(); return; }
  onChange();
  if (lastSchedule) await syncNotifications(lastSchedule);
}

export async function notificationAction(action: 'permission' | 'exact' | 'settings' | 'test' | 'sync') {
  try {
    if (action === 'permission') {
      await requestNativePermission();
      if (!reminderAccess.enabled) await invoke('reminder_access', { action: 'settings' });
    } else if (action === 'test') {
      await createChannel({ id: channelId, name: 'Расписание', importance: Importance.Default });
      await deliver([{ id: 991, title: 'Проверка уведомлений', body: 'Уведомления расписания включены.', channelId, autoCancel: true }]);
      notificationStatus = 'Тестовое уведомление отправлено';
    } else if (action === 'sync') {
      if (lastSchedule) await syncNotifications(lastSchedule);
    } else await invoke('reminder_access', { action });
  } catch { notificationStatus = 'Не удалось выполнить действие. Проверьте разрешения Android.'; }
  onChange();
}
