function completedTasks(tasks) {
  return [...tasks]
    .filter((task) => task.completed)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createHistoryPanel({ panel, listEl, emptyEl, closeButton, taskListWrap }, { getTasks, onChange }) {
  function render() {
    const history = completedTasks(getTasks());
    listEl.replaceChildren();
    emptyEl.hidden = history.length > 0;

    for (const task of history) {
      const item = document.createElement('li');
      item.className = 'history-item';

      const title = document.createElement('span');
      title.className = 'history-title';
      title.textContent = task.title;

      const date = document.createElement('span');
      date.className = 'history-date';
      date.textContent = formatDate(task.updatedAt);

      item.append(title, date);
      listEl.appendChild(item);
    }
  }

  async function open() {
    render();
    taskListWrap.hidden = true;
    panel.hidden = false;
    closeButton.focus();
    await onChange();
  }

  async function close() {
    panel.hidden = true;
    taskListWrap.hidden = false;
    await onChange();
  }

  closeButton.addEventListener('click', close);

  return { render, open, close };
}
