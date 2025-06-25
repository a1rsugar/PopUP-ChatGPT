let floatingBtn = null;
let menuBtn = null;
let floatingMenu = null;
let showFloatingBtn = true;

function createFloatingButton() {
  if (floatingBtn) return;

  floatingBtn = document.createElement('button');
  floatingBtn.textContent = '⭐';
  Object.assign(floatingBtn.style, {
    position: 'absolute',
    zIndex: 2147483647,
    padding: '6px 8px',
    fontSize: '16px',
    borderRadius: '6px',
    border: 'none',
    background: '#10a37f',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    userSelect: 'none',
    transition: 'opacity 0.2s ease',
    opacity: '0',
  });

  menuBtn = document.createElement('button');
  menuBtn.textContent = '⋮';
  Object.assign(menuBtn.style, {
    position: 'absolute',
    zIndex: 2147483648,
    padding: '6px 8px',
    fontSize: '16px',
    borderRadius: '6px',
    border: 'none',
    background: '#10a37f',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    userSelect: 'none',
    transition: 'opacity 0.2s ease',
    opacity: '0',
  });

  document.body.appendChild(floatingBtn);
  document.body.appendChild(menuBtn);

  floatingBtn.addEventListener('click', () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) return;

    const sentence = findSentenceContainingWord(text);

    chrome.runtime.sendMessage({
      action: 'selectedText',
      text: text,
      sentence: sentence
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Ошибка отправки сообщения:', chrome.runtime.lastError);
      } else if (response?.error) {
        console.error('Ошибка от background:', response.error);
      } else {
        console.log('Текст отправлен в background успешно');
      }
    });

    hideFloatingButton();
    hideFloatingMenu();
    selection?.removeAllRanges();
  });

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (floatingMenu && floatingMenu.style.display === 'block') {
      hideFloatingMenu();
    } else {
      showFloatingMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (floatingMenu && !floatingMenu.contains(e.target) && e.target !== menuBtn) {
      hideFloatingMenu();
    }
  });

  createFloatingMenu();
}

function findSentenceContainingWord(word) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return word;

  let container = selection.getRangeAt(0).commonAncestorContainer;
  while (container && container.nodeType !== 1) {
    container = container.parentNode;
  }

  let fullText = '';
  let attempts = 0;
  while (container && attempts < 5) {
    fullText = container.innerText || container.textContent || '';
    if (fullText.includes(word) && fullText.length > 10) break;
    container = container.parentNode;
    attempts++;
  }

  if (fullText) {
    const regex = /[^.!?。！？\u3000]*[.!?。！？\u3000]/g;
    const matches = [...fullText.matchAll(regex)];
    for (const m of matches) {
      if (m[0].includes(word)) return m[0].trim();
    }
  }

  return fullText || word;
}

function createFloatingMenu() {
  if (floatingMenu) return;

  floatingMenu = document.createElement('div');
  Object.assign(floatingMenu.style, {
    position: 'absolute',
    zIndex: 2147483649,
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    padding: '8px 12px',
    fontSize: '14px',
    color: '#222',
    display: 'none',
    userSelect: 'none',
    width: '180px',
  });

  floatingMenu.innerHTML = `
    <label style="display:flex; align-items:center; margin-bottom:6px; cursor:pointer;">
      <input type="checkbox" id="chkRemoveWord" style="margin-right:8px;">
      Explain the sentence
    </label>
    <label style="display:flex; align-items:center; margin-bottom:6px; cursor:pointer;">
      <input type="checkbox" id="chkRemoveSentence" style="margin-right:8px;">
      Explain the word
    </label>
    <label style="display:flex; align-items:center; cursor:pointer;">
      <input type="checkbox" id="chkExplainText" style="margin-right:8px;">
     Explain the selected text
    </label>
  `;

  document.body.appendChild(floatingMenu);

  const chkRemoveWord = floatingMenu.querySelector('#chkRemoveWord');
  const chkRemoveSentence = floatingMenu.querySelector('#chkRemoveSentence');
  const chkExplainText = floatingMenu.querySelector('#chkExplainText');

  chrome.storage.sync.get('checkboxStates', (data) => {
    const states = data.checkboxStates || {};
    chkRemoveWord.checked = !!states.removeWord;
    chkRemoveSentence.checked = !!states.removeSentence;
    chkExplainText.checked = !!states.explainText;
  });

  chkRemoveWord.addEventListener('change', () => {
    if (chkRemoveWord.checked) {
      chkRemoveSentence.checked = false;
      chkExplainText.checked = false;
    }
    saveCheckboxStates(chkRemoveWord.checked, chkRemoveSentence.checked, chkExplainText.checked);
  });

  chkRemoveSentence.addEventListener('change', () => {
    if (chkRemoveSentence.checked) {
      chkRemoveWord.checked = false;
      chkExplainText.checked = false;
    }
    saveCheckboxStates(chkRemoveWord.checked, chkRemoveSentence.checked, chkExplainText.checked);
  });

  chkExplainText.addEventListener('change', () => {
    if (chkExplainText.checked) {
      chkRemoveWord.checked = false;
      chkRemoveSentence.checked = false;
    }
    saveCheckboxStates(chkRemoveWord.checked, chkRemoveSentence.checked, chkExplainText.checked);
  });
}

function saveCheckboxStates(removeWord, removeSentence, explainText) {
  const states = { removeWord, removeSentence, explainText };
  chrome.storage.sync.set({ checkboxStates: states });
}

function showFloatingMenu() {
  if (!floatingMenu || !menuBtn) return;

  const rect = menuBtn.getBoundingClientRect();
  floatingMenu.style.top = `${window.scrollY + rect.bottom + 6}px`;
  floatingMenu.style.left = `${window.scrollX + rect.left}px`;
  floatingMenu.style.display = 'block';
}

function hideFloatingMenu() {
  if (floatingMenu) {
    floatingMenu.style.display = 'none';
  }
}

function showFloatingButton() {
  if (!showFloatingBtn) return hideFloatingButton();

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return hideFloatingButton();
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return hideFloatingButton();

  createFloatingButton();

  floatingBtn.style.top = `${window.scrollY + rect.top - floatingBtn.offsetHeight - 8}px`;
  floatingBtn.style.left = `${window.scrollX + rect.right - floatingBtn.offsetWidth - 28}px`;
  floatingBtn.style.opacity = '1';

  menuBtn.style.top = floatingBtn.style.top;
  menuBtn.style.left = `${window.scrollX + rect.right - menuBtn.offsetWidth}px`;
  menuBtn.style.opacity = '1';
}

function hideFloatingButton() {
  if (floatingBtn) floatingBtn.style.opacity = '0';
  if (menuBtn) menuBtn.style.opacity = '0';
  hideFloatingMenu();
}

document.addEventListener('selectionchange', () => {
  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      hideFloatingButton();
    } else {
      showFloatingButton();
    }
  }, 100);
});

document.addEventListener('mousedown', (e) => {
  if (
    floatingBtn &&
    e.target !== floatingBtn &&
    e.target !== menuBtn &&
    (!floatingMenu || !floatingMenu.contains(e.target))
  ) {
    hideFloatingButton();
  }
});
document.querySelectorAll('.prompt-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const textarea = button.nextElementSibling;
    textarea.classList.toggle('open');
  });
});

chrome.storage.sync.get('showFloatingBtn', (res) => {
  showFloatingBtn = typeof res.showFloatingBtn === 'boolean' ? res.showFloatingBtn : true;
});