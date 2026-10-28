import { cachedGroups, filterGroups, loadGroups, type Group } from './groups';
import { escape } from './views';
import { icon } from './icons';

export const picker = {
  open: false, changing: false, groups: cachedGroups(), query: '', selected: '',
  loading: false, busy: false, error: '', limit: 40,
};

export async function openPicker(changing: boolean, selected = '') {
  Object.assign(picker, { open: true, changing, selected, query: '', error: '', limit: 40, loading: true });
  try { picker.groups = await loadGroups(); }
  catch { picker.error = picker.groups.length ? 'Без сети · сохранённый список' : 'Не удалось загрузить группы. Проверьте подключение.'; }
  finally { picker.loading = false; }
}

export function pickerResults() {
  const groups = filterGroups(picker.groups, picker.query);
  return `<div class="picker-results-label mono"><span>${picker.loading && !picker.groups.length ? 'ЗАГРУЗКА…' : `НАЙДЕНО: ${groups.length}`}</span></div><div class="group-grid" role="group" aria-label="Группы">${groups.slice(0, picker.limit).map((group: Group) => `<button class="group-option mono" data-action="choose-group" data-group="${escape(group.name)}" aria-pressed="${picker.selected === group.name}" ${picker.busy ? 'disabled' : ''}><span>${escape(group.name)}</span>${picker.selected === group.name ? icon('check') : ''}</button>`).join('')}</div>${!groups.length && !picker.loading ? `<p class="settings-note">${picker.groups.length ? 'Группа не найдена. Проверьте название.' : escape(picker.error)}</p>` : ''}${groups.length > picker.limit ? '<button class="picker-more outline-button mono" data-action="more-groups">ПОКАЗАТЬ ЕЩЁ</button>' : ''}${picker.error ? `<p class="settings-note" role="status">${escape(picker.error)}</p>` : ''}${!picker.groups.length && !picker.loading ? '<button class="outline-button mono" data-action="retry-groups">ПОВТОРИТЬ</button>' : ''}`;
}

export function pickerView() {
  return `<div class="app-shell picker-shell" data-page="groups"><header class="picker-header">${picker.changing ? `<button class="text-button mono" data-action="cancel-group">${icon('back')} НАСТРОЙКИ</button>` : `<span class="mono">РАСПИСАНИЕ РИНХ</span>`}<span class="settings-mark" aria-hidden="true">${'<i></i>'.repeat(9)}</span></header><main><div class="picker-heading"><h1>${picker.changing ? 'Сменить группу' : 'Ваша группа'}</h1><p>Найдите и выберите свою группу.</p></div><label class="group-search">${icon('search')}<input id="group-query" type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Название группы" aria-label="Поиск группы" value="${escape(picker.query)}" ${picker.busy ? 'disabled' : ''}/></label><div id="group-results">${pickerResults()}</div></main><footer class="picker-footer">${picker.error ? `<p class="settings-note status-warning" role="status">${escape(picker.error)}</p>` : ''}<button class="picker-confirm" data-action="confirm-group" ${!picker.selected || picker.busy ? 'disabled' : ''}><span>${picker.busy ? 'Загрузка…' : picker.selected || 'Выберите группу'}</span><span class="mono">${picker.changing ? 'СОХРАНИТЬ' : 'ПРОДОЛЖИТЬ'} ${icon('arrow')}</span></button></footer></div>`;
}
