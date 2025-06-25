document.querySelectorAll('.prompt-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const textarea = button.nextElementSibling;
    textarea.classList.toggle('open');
  });
});

chrome.storage.sync.get('showFloatingBtn', (res) => {
  showFloatingBtn = typeof res.showFloatingBtn === 'boolean' ? res.showFloatingBtn : true;
});

const promptTextarea = document.getElementById('prompt');
const promptRemoveWordTextarea = document.getElementById('promptRemoveWord');
const promptRemoveSentenceTextarea = document.getElementById('promptRemoveSentence');
const promptExplainSentenceTextarea = document.getElementById('promptExplainSentence');
const promptExplainTextTextarea = document.getElementById('promptExplainText');

const explainSentenceCheckbox = document.getElementById('explainSentence');
const removeSentenceCheckbox = document.getElementById('removeSentence');
const removeWordCheckbox = document.getElementById('removeWord');
const explainTextCheckbox = document.getElementById('explainText');
const showFloatingBtnCheckbox = document.getElementById('showFloatingBtn');
const deepseekUrlInput = document.getElementById('deepseekUrlInput');
const chatgptUrlInput = document.getElementById('chatgptUrlInput');
const anotherUrlInput = document.getElementById('anotherUrlInput');

const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusDiv = document.getElementById('status');

const STORAGE_KEY = 'customPrompt';
const CHECKBOX_KEY = 'checkboxStates';
const FLOATING_BTN_KEY = 'showFloatingBtn';
const PROMPT_REMOVE_WORD_KEY = 'promptRemoveWord';
const PROMPT_REMOVE_SENTENCE_KEY = 'promptRemoveSentence';
const PROMPT_EXPLAIN_SENTENCE_KEY = 'promptExplainSentence';
const PROMPT_EXPLAIN_TEXT_KEY = 'promptExplainText';
const SELECTED_SERVICE_KEY = 'selectedService';
const DEEPSEEK_URL_KEY = 'deepseekCustomUrl';
const CHATGPT_URL_KEY = 'chatgptCustomUrl';
const ANOTHER_URL_KEY = 'anotherCustomUrl';

const defaultPrompt = '{selectedWord}\n{sentence}\nExplain the meaning of the word and its grammatical role in this context.';
const defaultPromptRemoveWord = '{sentence}\nExplain the grammar and meaning of this sentence.';
const defaultPromptRemoveSentence = '{selectedWord}\nTell me what this word means and how it is used.';
const defaultPromptExplainSentence = '{selectedWord}\n{sentence}\nCustom prompt';
const defaultPromptExplainText = '{selectedWord}\nAnalyze the text: explain its meaning and grammatical features.';


function toggleCustomUrlInputs(selectedService) {
  document.getElementById('deepseekUrlContainer').style.display = 
    selectedService === 'deepseek' ? 'block' : 'none';
  document.getElementById('chatgptUrlContainer').style.display = 
    selectedService === 'chatgpt' ? 'block' : 'none';
  document.getElementById('anotherUrlContainer').style.display = 
    selectedService === 'another' ? 'block' : 'none';
}

function setFields(data) {
  promptTextarea.value = data[STORAGE_KEY] || defaultPrompt;
  promptRemoveWordTextarea.value = data[PROMPT_REMOVE_WORD_KEY] || defaultPromptRemoveWord;
  promptRemoveSentenceTextarea.value = data[PROMPT_REMOVE_SENTENCE_KEY] || defaultPromptRemoveSentence;
  promptExplainSentenceTextarea.value = data[PROMPT_EXPLAIN_SENTENCE_KEY] || defaultPromptExplainSentence;
  promptExplainTextTextarea.value = data[PROMPT_EXPLAIN_TEXT_KEY] || defaultPromptExplainText;

  const checkboxStates = data[CHECKBOX_KEY] || {};
  removeSentenceCheckbox.checked = checkboxStates.removeSentence || false;
  removeWordCheckbox.checked = checkboxStates.removeWord || false;
  explainSentenceCheckbox.checked = checkboxStates.explainSentence || false;
  explainTextCheckbox.checked = checkboxStates.explainText || false;
  showFloatingBtnCheckbox.checked = data[FLOATING_BTN_KEY] !== false;

  const selectedService = data[SELECTED_SERVICE_KEY] || 'chatgpt';
  document.querySelector(`input[name="selectedService"][value="${selectedService}"]`).checked = true;
  
  deepseekUrlInput.value = data[DEEPSEEK_URL_KEY] || '';
  chatgptUrlInput.value = data[CHATGPT_URL_KEY] || '';
  anotherUrlInput.value = data[ANOTHER_URL_KEY] || '';
  
  toggleCustomUrlInputs(selectedService);
}

function loadSettings() {
  chrome.storage.sync.get([
    STORAGE_KEY,
    CHECKBOX_KEY,
    FLOATING_BTN_KEY,
    PROMPT_REMOVE_WORD_KEY,
    PROMPT_REMOVE_SENTENCE_KEY,
    PROMPT_EXPLAIN_SENTENCE_KEY,
    PROMPT_EXPLAIN_TEXT_KEY,
    SELECTED_SERVICE_KEY,
    DEEPSEEK_URL_KEY,
    CHATGPT_URL_KEY,
    ANOTHER_URL_KEY
  ], (data) => {
    setFields(data);
  });
}

function saveSettings() {
  const promptText = promptTextarea.value.trim();
  const promptRemoveWord = promptRemoveWordTextarea.value.trim();
  const promptRemoveSentence = promptRemoveSentenceTextarea.value.trim();
  const promptExplainSentence = promptExplainSentenceTextarea.value.trim();
  const promptExplainText = promptExplainTextTextarea.value.trim();

  const checkboxStates = {
    removeSentence: removeSentenceCheckbox.checked,
    removeWord: removeWordCheckbox.checked,
    explainSentence: explainSentenceCheckbox.checked,
    explainText: explainTextCheckbox.checked
  };

  const showFloatingBtn = showFloatingBtnCheckbox.checked;
  const selectedService = document.querySelector('input[name="selectedService"]:checked').value;
  const deepseekUrl = deepseekUrlInput.value.trim();
  const chatgptUrl = chatgptUrlInput.value.trim();
  const anotherUrl = anotherUrlInput.value.trim();

  chrome.storage.sync.set({
    [STORAGE_KEY]: promptText,
    [CHECKBOX_KEY]: checkboxStates,
    [FLOATING_BTN_KEY]: showFloatingBtn,
    [PROMPT_REMOVE_WORD_KEY]: promptRemoveWord,
    [PROMPT_REMOVE_SENTENCE_KEY]: promptRemoveSentence,
    [PROMPT_EXPLAIN_SENTENCE_KEY]: promptExplainSentence,
    [PROMPT_EXPLAIN_TEXT_KEY]: promptExplainText,
    [SELECTED_SERVICE_KEY]: selectedService,
    [DEEPSEEK_URL_KEY]: deepseekUrl,
    [CHATGPT_URL_KEY]: chatgptUrl,
    [ANOTHER_URL_KEY]: anotherUrl
  }, () => {
    statusDiv.textContent = 'Сохранено!';
    setTimeout(() => (statusDiv.textContent = ''), 1500);

    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith('http')) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateShowFloatingBtn',
            show: showFloatingBtn
          }, () => {});
        }
      }
    });
  });
}

function resetSettings() {
  chrome.storage.sync.set({
    [STORAGE_KEY]: defaultPrompt,
    [CHECKBOX_KEY]: { removeSentence: false, removeWord: false, explainSentence: false, explainText: false },
    [FLOATING_BTN_KEY]: true,
    [PROMPT_REMOVE_WORD_KEY]: defaultPromptRemoveWord,
    [PROMPT_REMOVE_SENTENCE_KEY]: defaultPromptRemoveSentence,
    [PROMPT_EXPLAIN_SENTENCE_KEY]: defaultPromptExplainSentence,
    [PROMPT_EXPLAIN_TEXT_KEY]: defaultPromptExplainText,
    [SELECTED_SERVICE_KEY]: 'chatgpt',
    [DEEPSEEK_URL_KEY]: '',
    [CHATGPT_URL_KEY]: '',
    [ANOTHER_URL_KEY]: ''
  }, () => {
    loadSettings();
    statusDiv.textContent = 'Промпты сброшены!';
    setTimeout(() => (statusDiv.textContent = ''), 1500);
  });
}

removeSentenceCheckbox.addEventListener('change', () => {
  if (removeSentenceCheckbox.checked) {
    removeWordCheckbox.checked = false;
    explainSentenceCheckbox.checked = false;
    explainTextCheckbox.checked = false;
  }
});

removeWordCheckbox.addEventListener('change', () => {
  if (removeWordCheckbox.checked) {
    removeSentenceCheckbox.checked = false;
    explainSentenceCheckbox.checked = false;
    explainTextCheckbox.checked = false;
  }
});

explainSentenceCheckbox.addEventListener('change', () => {
  if (explainSentenceCheckbox.checked) {
    removeSentenceCheckbox.checked = false;
    removeWordCheckbox.checked = false;
    explainTextCheckbox.checked = false;
  }
});

explainTextCheckbox.addEventListener('change', () => {
  if (explainTextCheckbox.checked) {
    removeSentenceCheckbox.checked = false;
    removeWordCheckbox.checked = false;
    explainSentenceCheckbox.checked = false;
  }
});

document.querySelectorAll('input[name="selectedService"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    toggleCustomUrlInputs(e.target.value);
  });
});

saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetSettings);
window.addEventListener('load', loadSettings);

const promptPopup = document.getElementById('promptPopup');
const promptHeader = document.getElementById('togglePromptsBtn');
promptHeader.addEventListener('click', () => {
  promptPopup.classList.toggle('open');
});