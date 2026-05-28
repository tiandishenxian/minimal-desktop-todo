import assert from 'node:assert/strict';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  addDays,
  addMonthsClamped,
  getVisibleTasks,
  nextDueFor,
  REPEAT_TYPES,
} from '../app/src/repeat-engine.js';

function testRepeatEngine() {
  assert.equal(addDays('2026-05-27', 1), '2026-05-28');
  assert.equal(addDays('2026-05-27', 7), '2026-06-03');
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsClamped('2026-03-31', 1), '2026-04-30');
  assert.equal(addMonthsClamped('2026-05-30', 1), '2026-06-30');

  assert.equal(nextDueFor({
    nextDue: '2026-05-27',
    repeat: { enabled: true, type: REPEAT_TYPES.DAILY, interval: 1 },
  }), '2026-05-28');

  assert.equal(nextDueFor({
    nextDue: '2026-05-27',
    repeat: { enabled: true, type: REPEAT_TYPES.WEEKLY, interval: 1 },
  }), '2026-06-03');

  assert.equal(nextDueFor({
    nextDue: '2026-01-31',
    repeat: { enabled: true, type: REPEAT_TYPES.MONTHLY, interval: 1 },
  }), '2026-02-28');

  assert.equal(nextDueFor({
    nextDue: '2026-05-27',
    repeat: { enabled: true, type: REPEAT_TYPES.INTERVAL_DAYS, interval: 3 },
  }), '2026-05-30');
}

function testVisibleTasks() {
  const tasks = [
    { id: 'a', completed: false, order: 1, createdAt: '2026-05-27T00:00:00Z' },
    { id: 'b', completed: true, order: 2, createdAt: '2026-05-27T00:00:00Z' },
    { id: 'c', completed: false, dueDate: '2026-05-28', order: 3, createdAt: '2026-05-27T00:00:00Z' },
    { id: 'd', completed: false, dueDate: '2026-05-26', order: 4, createdAt: '2026-05-27T00:00:00Z' },
    {
      id: 'e',
      completed: false,
      order: 5,
      createdAt: '2026-05-27T00:00:00Z',
      repeat: { enabled: true, type: REPEAT_TYPES.DAILY, interval: 1 },
      nextDue: '2026-05-28',
    },
    {
      id: 'f',
      completed: false,
      order: 6,
      createdAt: '2026-05-27T00:00:00Z',
      repeat: { enabled: true, type: REPEAT_TYPES.DAILY, interval: 1 },
      nextDue: '2026-05-27',
    },
  ];

  assert.deepEqual(getVisibleTasks(tasks, '2026-05-27').map((task) => task.id), ['a', 'd', 'f']);
}

async function testStorageSmoke() {
  const trashDir = 'D:\\trash';
  await mkdir(trashDir, { recursive: true });
  const dir = join(trashDir, `minimal-desktop-todo-active-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const tasksPath = join(dir, 'tasks.json');
  const settingsPath = join(dir, 'settings.json');

  await writeFile(tasksPath, `${JSON.stringify({ version: 1, tasks: [] }, null, 2)}\n`, 'utf8');
  await writeFile(settingsPath, `${JSON.stringify({ version: 1, window: { width: 300, height: 420 }, app: { startAtLogin: false } }, null, 2)}\n`, 'utf8');

  const tasks = JSON.parse(await readFile(tasksPath, 'utf8'));
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));

  assert.equal(tasks.version, 1);
  assert.deepEqual(tasks.tasks, []);
  assert.equal(settings.window.width, 300);
  assert.equal(settings.app.startAtLogin, false);

  await rename(dir, join(trashDir, `minimal-desktop-todo-test-${Date.now()}`));
}

testRepeatEngine();
testVisibleTasks();
await testStorageSmoke();

console.log('All tests passed.');
