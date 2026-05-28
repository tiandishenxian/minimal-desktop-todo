let activeMenu = null;

const TEXT_INPUT_SELECTOR = '#taskInput, .task-edit';

export function initTextContextMenu() {
  document.addEventListener(
    'contextmenu',
    (event) => {
      const input = event.target.closest?.(TEXT_INPUT_SELECTOR);
      if (!input || input.disabled || input.readOnly) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openTextContextMenu(input, event.clientX, event.clientY);
    },
    true,
  );
}

function openTextContextMenu(input, x, y) {
  closeTextContextMenu();

  const menu = document.createElement('div');
  menu.className = 'text-context-menu';
  menu.setAttribute('role', 'menu');

  const hasSelection = input.selectionStart !== input.selectionEnd;
  const items = [
    ['undo', '\u64a4\u9500', false],
    ['cut', '\u526a\u5207', !hasSelection],
    ['copy', '\u590d\u5236', !hasSelection],
    ['paste', '\u7c98\u8d34', false],
    ['selectAll', '\u5168\u9009', !input.value],
  ];

  for (const [action, label, disabled] of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.disabled = disabled;
    button.textContent = label;
    button.addEventListener('click', async () => {
      await runAction(input, action);
      closeTextContextMenu();
    });
    menu.appendChild(button);
  }

  menu.addEventListener('click', (event) => event.stopPropagation());
  document.body.appendChild(menu);
  placeMenu(menu, x, y);

  const abortController = new AbortController();
  const options = { signal: abortController.signal };
  window.addEventListener('click', closeTextContextMenu, options);
  window.addEventListener('blur', closeTextContextMenu, options);
  window.addEventListener('scroll', closeTextContextMenu, true);
  window.addEventListener('keydown', closeOnEscape, options);
  activeMenu = { element: menu, abortController };
}

function placeMenu(menu, x, y) {
  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(Math.max(margin, x), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(margin, y), window.innerHeight - rect.height - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeOnEscape(event) {
  if (event.key === 'Escape') {
    closeTextContextMenu();
  }
}

function closeTextContextMenu() {
  if (!activeMenu) {
    return;
  }

  window.removeEventListener('scroll', closeTextContextMenu, true);
  activeMenu.abortController.abort();
  activeMenu.element.remove();
  activeMenu = null;
}

async function runAction(input, action) {
  input.focus();

  if (action === 'undo') {
    document.execCommand('undo');
    return;
  }

  if (action === 'selectAll') {
    input.select();
    return;
  }

  if (action === 'copy') {
    await writeClipboard(getSelection(input));
    return;
  }

  if (action === 'cut') {
    await writeClipboard(getSelection(input));
    replaceSelection(input, '');
    return;
  }

  if (action === 'paste') {
    const text = await readClipboard();
    if (text) {
      replaceSelection(input, text);
    }
  }
}

function getSelection(input) {
  return input.value.slice(input.selectionStart || 0, input.selectionEnd || 0);
}

function replaceSelection(input, text) {
  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;
  input.setRangeText(text, start, end, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function readClipboard() {
  try {
    return await Neutralino.clipboard.readText();
  } catch {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }
}

async function writeClipboard(text) {
  if (!text) {
    return;
  }

  try {
    await Neutralino.clipboard.writeText(text);
  } catch {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be denied by the host; keep the menu silent.
    }
  }
}
