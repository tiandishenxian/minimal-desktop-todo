export const REPEAT_TYPES = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  INTERVAL_DAYS: 'interval-days',
};

export function todayLocal() {
  return toDateKey(new Date());
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function addDays(dateKey, days) {
  const date = parseDateKey(dateKey);
  if (!date) {
    return todayLocal();
  }

  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function addMonthsClamped(dateKey, months) {
  const date = parseDateKey(dateKey);
  if (!date) {
    return todayLocal();
  }

  const originalDay = date.getDate();
  const targetMonth = date.getMonth() + months;
  const target = new Date(date.getFullYear(), targetMonth, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDay));
  return toDateKey(target);
}

export function isRepeating(task) {
  return Boolean(task?.repeat?.enabled && task.repeat.type && task.repeat.type !== REPEAT_TYPES.NONE);
}

export function isTaskVisible(task, today = todayLocal()) {
  if (!task || task.completed || task.deleted) {
    return false;
  }

  if (isRepeating(task)) {
    return !task.nextDue || task.nextDue <= today;
  }

  return !task.dueDate || task.dueDate <= today;
}

export function getVisibleTasks(tasks, today = todayLocal()) {
  return [...tasks]
    .filter((task) => isTaskVisible(task, today))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function nextDueFor(task) {
  const repeat = task.repeat || { type: REPEAT_TYPES.NONE, interval: 1 };
  const base = task.nextDue || task.dueDate || todayLocal();
  const interval = Math.max(1, Number.parseInt(repeat.interval, 10) || 1);

  switch (repeat.type) {
    case REPEAT_TYPES.DAILY:
      return addDays(base, interval);
    case REPEAT_TYPES.WEEKLY:
      return addDays(base, interval * 7);
    case REPEAT_TYPES.MONTHLY:
      return addMonthsClamped(base, interval);
    case REPEAT_TYPES.INTERVAL_DAYS:
      return addDays(base, interval);
    default:
      return null;
  }
}

export function describeRepeat(task) {
  if (!isRepeating(task)) {
    return task.dueDate ? `Due ${task.dueDate}` : '';
  }

  const interval = Math.max(1, Number.parseInt(task.repeat.interval, 10) || 1);
  const label = {
    [REPEAT_TYPES.DAILY]: interval === 1 ? 'Daily' : `Every ${interval} days`,
    [REPEAT_TYPES.WEEKLY]: interval === 1 ? 'Weekly' : `Every ${interval} weeks`,
    [REPEAT_TYPES.MONTHLY]: interval === 1 ? 'Monthly' : `Every ${interval} months`,
    [REPEAT_TYPES.INTERVAL_DAYS]: `Every ${interval} days`,
  }[task.repeat.type] || 'Repeats';

  return `${label} · next ${task.nextDue || task.dueDate || todayLocal()}`;
}
