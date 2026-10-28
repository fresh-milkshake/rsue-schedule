import { icon } from './icons';
import { dayBounds } from './reminder-plan';
import { reminderAccess, reminderSettings, notificationBusy, notificationStatus, scheduledCount } from './notifications';
import { isTauri } from '@tauri-apps/api/core';
import { preferences } from './preferences';
import { appMetadata } from './app-meta';
import { backgrounds } from './themes';
import { currentGroup } from './groups';
import { clock, dateLabel, minutes, moscowNow, nextPair, pairState, pluralPairs, populated, shortDays, type Day, type Pair, type Schedule, type Week } from './schedule';

export const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const button = (action: string, label: string, glyph: string, extra = '') => `<button class="icon-button" data-action="${action}" aria-label="${label}" ${extra}>${icon(glyph)}</button>`;

function weekNavigation(data: Schedule, index: number) {
  const week = data.weeks[index];
  const first = week.days[0].date;
  const last = week.days.at(-1)!.date;
  return `<div class="week-navigation">${button('previous', 'Предыдущая неделя', 'back', index === 0 ? 'disabled' : '')}<div><span class="mono bright">${first && last ? `${first.slice(0, 5)} — ${last.slice(0, 5)}` : escape(week.name)}</span><span class="mono">${week.parity === 1 ? 'НЕЧЁТНАЯ' : 'ЧЁТНАЯ'} · ${week.id}</span></div>${button('next', 'Следующая неделя', 'forward', index === data.weeks.length - 1 ? 'disabled' : '')}</div>`;
}

function dayPicker(week: Week, selected: number) {
  return `<div class="day-picker" role="group" aria-label="Дни недели">${week.days.map((d, i) => `<button data-action="select-day" data-day="${i}" class="day-button ${i === selected ? 'selected' : ''} ${d.date === moscowNow().date ? 'is-today' : ''}" aria-pressed="${i === selected}" aria-label="${escape(d.name)}, ${dateLabel(d.date)}"><span class="mono">${shortDays[d.id - 1]}</span><span class="day-number">${d.date?.slice(0, 2) ?? d.id}</span><i class="day-dot ${populated(d).length ? 'has-lessons' : ''}" aria-hidden="true"></i></button>`).join('')}</div>`;
}

function upcoming(data: Schedule) {
  const next = nextPair(data);
  if (!next) return '';
  const { day, pair } = next;
  const live = pairState(day, pair) === 'live';
  const today = day.date === moscowNow().date;
  const left = live ? minutes(pair.endTime) - moscowNow().minute : minutes(pair.startTime) - moscowNow().minute;
  const status = today ? `${live ? 'ДО КОНЦА' : 'ЧЕРЕЗ'} ${left >= 60 ? `${Math.floor(left / 60)} Ч ${left % 60} М` : `${left} МИН`}` : dateLabel(day.date).toUpperCase();
  const progress = live ? Math.max(0, Math.min(12, Math.ceil((moscowNow().minute - minutes(pair.startTime)) / (minutes(pair.endTime) - minutes(pair.startTime)) * 12))) : 0;
  return `<section class="upcoming ${live ? 'is-live' : ''}" aria-label="${live ? 'Текущее' : 'Ближайшее'} занятие"><div class="upcoming-top mono"><span>${live ? '<i class="signal-dot"></i> СЕЙЧАС' : 'ДАЛЕЕ'} / ${clock(pair.startTime)}</span><span>${status}</span></div><p>${escape(pair.lessons.map(l => l.subject).join(' / '))}</p><div class="segments" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i class="${i < progress ? 'filled' : ''}"></i>`).join('')}</div></section>`;
}

function lessonRow(day: Day, pair: Pair) {
  const status = pairState(day, pair);
  return `<article class="lesson ${status}"><div class="time-column"><span>${clock(pair.startTime)}</span><span class="end-time mono">${clock(pair.endTime)}</span><span class="pair-number mono">${String(pair.id).padStart(2, '0')}</span></div><div class="lesson-content">${pair.lessons.map(l => `<div class="lesson-item"><span class="lesson-kind mono">${escape(l.kind.name)}${status === 'live' ? ' <span class="live-label">· СЕЙЧАС</span>' : ''}</span><h2>${escape(l.subject)}</h2><span class="teacher">${escape(l.teacher.name)}</span><div class="lesson-footer"><span class="room mono">${icon('pin')}${escape(l.audience || 'Аудитория не указана')}</span>${l.subgroup.id ? `<span class="mono">${escape(l.subgroup.name)}</span>` : ''}</div></div>`).join('')}</div></article>`;
}

export function dayView(data: Schedule, selected: { week: number; day: number }) {
  const week = data.weeks[selected.week];
  const day = week.days[selected.day];
  const pairs = populated(day);
  const bounds = dayBounds(day);
  const duration = pairs.reduce((n, p) => n + minutes(p.endTime) - minutes(p.startTime), 0);
  return `<section class="date-header"><span class="date-display" aria-hidden="true">${day.date?.slice(0, 2) ?? '—'}</span><div><h1 aria-label="${escape(day.name)}, ${dateLabel(day.date)}">${escape(day.name)} <span>${day.date ? dateLabel(day.date).split(' ').slice(1).join(' ') : ''}</span></h1><span class="mono">${pluralPairs(pairs.length)}${bounds ? ` · ${clock(bounds.start)}—${clock(bounds.end)}` : ''}${day.date === moscowNow().date ? ' · СЕГОДНЯ' : ''}</span></div></section>${weekNavigation(data, selected.week)}${dayPicker(week, selected.day)}${day.date === moscowNow().date ? upcoming(data) : ''}<section class="schedule-list" aria-label="Занятия"><div class="section-label mono"><span>ПЛАН НА ДЕНЬ</span><button class="text-button" data-action="today">СЕГОДНЯ ${icon('arrow')}</button></div>${pairs.length ? pairs.map(p => lessonRow(day, p)).join('') : '<div class="empty-state">Занятий нет</div>'}${pairs.length ? `<div class="day-summary mono"><span>${pluralPairs(pairs.length)}</span><span>${Math.floor(duration / 60)} Ч ${duration % 60 ? `${duration % 60} МИН` : ''} ЗАНЯТИЙ</span></div>` : ''}</section>`;
}

export function weekView(data: Schedule, index: number) {
  const week = data.weeks[index];
  const count = week.days.reduce((n, d) => n + populated(d).length, 0);
  return `<div class="week-heading"><h1>Неделя <span class="week-number">${String(week.id).padStart(2, '0')}</span></h1><span class="mono">${pluralPairs(count)}</span><button class="text-button mono" data-action="today">СЕГОДНЯ ${icon('arrow')}</button></div>${weekNavigation(data, index)}<div class="week-meter" role="group" aria-label="Количество пар по дням">${week.days.map((day, i) => {
    const pairs = populated(day);
    return `<button data-action="select-day" data-day="${i}" class="meter-day ${day.date === moscowNow().date ? 'is-today' : ''}" aria-label="${escape(day.name)}, ${pluralPairs(pairs.length)}"><span class="mono">${shortDays[day.id - 1]}</span><span class="meter-slots" aria-hidden="true">${day.pairs.map(p => `<i class="${p.lessons.length ? 'filled' : ''}"></i>`).join('')}</span><span class="mono">${pairs.length}</span></button>`;
  }).join('')}</div><section class="week-list" aria-label="Расписание на неделю">${week.days.map((day, i) => {
    const pairs = populated(day);
    const bounds = dayBounds(day);
    return `<section class="week-day ${day.date === moscowNow().date ? 'is-today' : ''}"><div class="week-date"><span>${day.date?.slice(0, 2) ?? shortDays[day.id - 1]}</span><span class="mono">${shortDays[day.id - 1]}</span></div><div class="week-day-content"><button class="week-day-heading" data-action="select-day" data-day="${i}" aria-label="Открыть день: ${escape(day.name)}"><span>${escape(day.name)}</span><span class="mono">${bounds ? `${clock(bounds.start)}—${clock(bounds.end)}` : 'НЕТ ПАР'}${icon('forward')}</span></button>${pairs.map(p => `<article class="week-lesson"><span class="week-time mono">${clock(p.startTime)}<span>${clock(p.endTime)}</span></span><div>${p.lessons.map(l => `<div class="week-lesson-item"><h2>${escape(l.subject)}</h2><span class="week-meta">${escape(l.kind.shortName)} · ${escape(l.audience || '—')}<span class="week-teacher"> · ${escape(l.teacher.name)}</span>${l.subgroup.id ? ` · ${escape(l.subgroup.name)}` : ''}</span></div>`).join('')}</div></article>`).join('')}</div></section>`;
  }).join('')}</section>`;
}

function appearanceSettings() {
  const segment = (key: 'fontSize' | 'density', options: [string, string][]) => `<div class="segmented" role="group" aria-label="${key === 'fontSize' ? 'Размер шрифта' : 'Плотность интерфейса'}">${options.map(([value, label]) => `<button class="mono" data-action="appearance" data-key="${key}" data-value="${value}" aria-pressed="${preferences[key] === value}">${label}</button>`).join('')}</div>`;
  const selected = backgrounds.find(item => item.id === preferences.background)!;
  return `<section class="settings-section appearance-section" aria-label="Оформление"><div class="setting-caption"><h2>Фон приложения</h2><span class="mono">${selected.name}</span></div><div class="background-presets" role="group" aria-label="Цвет фона">${backgrounds.map(item => `<button class="background-preset" style="--swatch:${item.color}" data-action="appearance" data-key="background" data-value="${item.id}" aria-label="Фон: ${item.name}" aria-pressed="${preferences.background === item.id}"><span class="swatch-sample" aria-hidden="true">Aa</span><span class="swatch-check" aria-hidden="true">${icon('check')}</span><span class="mono">${item.name}</span></button>`).join('')}</div><div class="setting-block"><h2>Размер шрифта</h2>${segment('fontSize', [['small', '90%'], ['normal', '100%'], ['large', '120%']])}</div><div class="setting-block"><h2>Плотность расписания</h2>${segment('density', [['compact', 'ПЛОТНО'], ['comfortable', 'СВОБОДНО']])}</div><div class="setting-row"><div><h2 id="label-teachers">Преподаватели</h2><p>Имена в расписании дня и недели.</p></div><button class="toggle" role="switch" aria-checked="${preferences.teachers}" aria-labelledby="label-teachers" data-action="appearance" data-key="teachers"><i></i></button></div></section>`;
}

function notificationSettings() {
  const native = isTauri() && reminderAccess.android;
  const toggle = (key: keyof typeof reminderSettings, label: string, detail: string) => `<div class="setting-row"><div><h2 id="label-${key}">${label}</h2><p>${detail}</p></div><button class="toggle" role="switch" aria-checked="${reminderSettings[key]}" aria-labelledby="label-${key}" data-action="toggle-reminder" data-key="${key}"><i></i></button></div>`;
  return `<section class="settings-section" aria-label="Уведомления">${!native ? '<p class="settings-note">Системные уведомления доступны в Android-приложении.</p>' : `<div class="permission-row"><div><h2>Доступ к уведомлениям</h2><p>${reminderAccess.enabled ? 'Разрешён' : 'Нужно разрешение Android'}</p></div><button class="outline-button mono" data-action="notification" data-operation="${reminderAccess.enabled ? 'settings' : 'permission'}">${reminderAccess.enabled ? 'ANDROID' : 'РАЗРЕШИТЬ'}</button></div><div class="permission-row"><div><h2>Точное время</h2><p>${reminderAccess.exact ? 'Разрешено' : 'Без разрешения возможна задержка.'}</p></div><button class="outline-button mono" data-action="notification" data-operation="exact">${reminderAccess.exact ? 'ANDROID' : 'ВКЛЮЧИТЬ'}</button></div>`}${toggle('daily', 'Расписание на день', 'Время занятий при первом открытии за день.')}${toggle('beforeEnd', 'За 15 минут до конца', 'Перед окончанием последней пары.')}${toggle('end', 'Окончание занятий', 'В момент окончания последней пары.')}${native ? `<div class="notification-actions"><button class="outline-button mono" data-action="notification" data-operation="test" ${!reminderAccess.enabled ? 'disabled' : ''}>ПРОВЕРИТЬ</button><button class="outline-button mono" data-action="notification" data-operation="sync" ${notificationBusy ? 'disabled' : ''}>${notificationBusy ? 'ОБНОВЛЕНИЕ…' : 'СИНХРОНИЗИРОВАТЬ'}</button></div><div class="info-row reminders-total"><span>Запланировано</span><span class="mono">${scheduledCount}</span></div>` : ''}<p class="settings-note">${native ? 'После изменений в расписании обновите напоминания.' : 'Настройки сохраняются на этом устройстве.'}</p>${notificationStatus ? `<p class="settings-note status-warning" role="status">${escape(notificationStatus)}</p>` : ''}</section>`;
}

export function settingsView(syncTime: string) {
  const application = `<section class="settings-section" aria-label="Приложение"><div class="app-identity"><span class="mono">${escape(currentGroup ?? "")}</span><h2>${escape(appMetadata.name)}</h2><span>Сделано с любовью ❤️</span></div><div class="info-row"><span>Автор</span><a class="author-link" href="${escape(appMetadata.authorUrl)}" target="_blank" rel="noopener noreferrer" data-action="author" aria-label="${escape(appMetadata.authorLogin)} на GitHub">${escape(appMetadata.authorLogin)} ${icon('external')}</a></div><div class="info-row"><span>Версия</span><span class="mono">${escape(appMetadata.version)}</span></div><div class="info-row"><span>Часовой пояс</span><span>Москва · UTC+3</span></div><div class="info-row"><span>Обновлено</span><span>${syncTime}</span></div><button class="source-button mono" data-action="source">ИСТОЧНИК РАСПИСАНИЯ ${icon('external')}</button></section>`;
  return `<div class="settings-heading"><h1>Настройки</h1><span class="settings-mark" aria-hidden="true">${Array.from({ length: 9 }, () => '<i></i>').join('')}</span></div><div class="settings-panel settings-page"><h2 class="settings-section-title mono">РАСПИСАНИЕ</h2><button class="group-setting" data-action="change-group"><span>Группа</span><span class="mono">${escape(currentGroup ?? 'Не выбрана')} ${icon('forward')}</span></button><h2 class="settings-section-title mono">ОФОРМЛЕНИЕ</h2>${appearanceSettings()}<h2 class="settings-section-title mono">УВЕДОМЛЕНИЯ</h2>${notificationSettings()}<h2 class="settings-section-title mono">ПРИЛОЖЕНИЕ</h2>${application}</div>`;
}
