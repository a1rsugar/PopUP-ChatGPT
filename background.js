let popupWindowId = null;
let popupTabId = null;

const defaultPrompt = '{selectedWord}\n{sentence}\nExplain the meaning of the word and its grammatical role in this context.';
const defaultPromptRemoveWord = '{sentence}\nExplain the grammar and meaning of this sentence.';
const defaultPromptRemoveSentence = '{selectedWord}\nTell me what this word means and how it is used.';
const defaultPromptExplainSentence = '{selectedWord}\n{sentence}\nCustom prompt';
const defaultPromptExplainText = '{selectedWord}\nAnalyze the text: explain its meaning and grammatical features.';

const DEFAULT_SERVICE_URLS = {
  chatgpt: 'https://chatgpt.com/c/',
  deepseek: 'https://chat.deepseek.com/a/',
  another: 'https://'
};

let serviceUrls = {...DEFAULT_SERVICE_URLS};

function buildPrompt(selectedWord, sentence, settings = {}, checkboxes = {}) {
  const { removeWord, removeSentence, explainSentence, explainText } = checkboxes;

  if (removeWord && removeSentence) return '';

  let template = defaultPrompt;
  if (explainText && settings.promptExplainText) {
    template = settings.promptExplainText;
  } else if (explainSentence && settings.promptExplainSentence) {
    template = settings.promptExplainSentence;
  } else if (removeWord && settings.promptRemoveWord) {
    template = settings.promptRemoveWord;
  } else if (removeSentence && settings.promptRemoveSentence) {
    template = settings.promptRemoveSentence;
  } else if (settings.customPrompt) {
    template = settings.customPrompt;
  }

  return template
    .replace(/\{selectedWord\}/g, selectedWord || '')
    .replace(/\{sentence\}/g, sentence || '')
    .trim();
}

function copyToClipboard(tabId, text) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (text) => {
      navigator.clipboard.writeText(text).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      });
    },
    args: [text]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error copying text:', chrome.runtime.lastError);
    }
  });
}

function insertAndSendText(tabId, text, callback) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (text) => {
      return new Promise((resolve) => {
        const MAX_RETRIES = 30;
        const RETRY_DELAY = 500;
        let retries = 0;

        function attemptInsert() {
          const loginFields = document.querySelector('input[name="username"], input[type="password"]');
          if (loginFields) {
            resolve({ error: 'Authorization required in the chat service.' });
            return;
          }

          const selectors = [
            'textarea',
            'textarea[data-testid="chat-input"]',
            'textarea#prompt-textarea',
            '[contenteditable="true"]'
          ];
          const input = selectors.map(s => document.querySelector(s)).find(Boolean);

          if (!input) {
            if (retries >= MAX_RETRIES) {
              resolve({ error: 'Input field not found after multiple attempts.' });
              return;
            }
            retries++;
            setTimeout(attemptInsert, RETRY_DELAY);
            return;
          }

          try {
            input.focus();
            input.value = '';
            document.execCommand('insertText', false, text);
            input.dispatchEvent(new InputEvent('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            const sendButton = document.querySelector('button[data-testid="send-button"]') ||
              Array.from(document.querySelectorAll('button')).find(b => 
                b.textContent.includes('➤') || b.textContent.includes('Send')
              );

            if (sendButton) {
              setTimeout(() => {
                sendButton.click();
                resolve({ success: true });
              }, 500);
            } else {
              input.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Enter', 
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true 
              }));
              resolve({ success: true });
            }
          } catch (error) {
            resolve({ error: `Insert error: ${error.message}` });
          }
        }

        attemptInsert();
      });
    },
    args: [text]
  }).then((results) => {
    if (results?.[0]?.result?.error) {
      chrome.notifications.create({
        type: 'basic',
        title: 'Error',
        message: results[0].result.error,
        iconUrl: 'icons/icon48.png'
      });
    }
    if (callback) callback();
  }).catch((error) => {
    console.error('Script execution error:', error);
    if (callback) callback();
  });
}

async function openOrReusePopupWithText(text) {
  try {
    const data = await chrome.storage.sync.get([
      'selectedService', 
      'deepseekCustomUrl',
      'chatgptCustomUrl',
      'anotherCustomUrl'
    ]);
    const selectedService = data.selectedService || 'chatgpt';
    
    if (selectedService === 'deepseek' && data.deepseekCustomUrl) {
      serviceUrls.deepseek = data.deepseekCustomUrl;
    } else if (selectedService === 'chatgpt' && data.chatgptCustomUrl) {
      serviceUrls.chatgpt = data.chatgptCustomUrl;
    } else if (selectedService === 'another' && data.anotherCustomUrl) {
      serviceUrls.another = data.anotherCustomUrl;
    } else {
      serviceUrls = {...DEFAULT_SERVICE_URLS};
    }
    
    const serviceUrl = serviceUrls[selectedService];
    
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(tab => 
      tab.url && tab.url.startsWith(serviceUrl)
    );

    if (existingTab) {
      popupTabId = existingTab.id;
      popupWindowId = existingTab.windowId;

      await chrome.windows.update(popupWindowId, { focused: true });
      await chrome.tabs.update(popupTabId, { active: true });
      
      setTimeout(() => insertAndSendText(popupTabId, text), 300);
    } else {
      createNewPopupWindow(text, serviceUrl);
    }
  } catch (error) {
    console.error('Error opening/reusing window:', error);
    chrome.notifications.create({
      type: 'basic',
      title: 'Error',
      message: 'Failed to open chat',
      iconUrl: 'icons/icon48.png'
    });
  }
}

function createNewPopupWindow(text, serviceUrl) {
  chrome.windows.create({
    url: serviceUrl,
    type: 'popup',
    width: 800,
    height: 600,
    left: 100,
    top: 100
  }, (newWindow) => {
    if (!newWindow?.tabs?.[0]) {
      chrome.notifications.create({
        type: 'basic',
        title: 'Error',
        message: 'Failed to open chat window.',
        iconUrl: 'icons/icon48.png'
      });
      return;
    }

    popupWindowId = newWindow.id;
    popupTabId = newWindow.tabs[0].id;

    const onTabUpdated = (tabId, changeInfo) => {
      if (tabId === popupTabId && changeInfo.status === 'complete') {
        insertAndSendText(tabId, text);
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
      }
    };

    chrome.tabs.onUpdated.addListener(onTabUpdated);
  });
}

async function handleSelectedWord(tabId, selectedWord) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [selectedWord],
      func: (word) => {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return { error: 'Failed to get selection.' };

        let container = selection.getRangeAt(0).commonAncestorContainer;
        while (container && container.nodeType !== 1) {
          container = container.parentNode;
        }

        let fullText = '';
        let attempts = 0;
        const MAX_ATTEMPTS = 5;

        while (container && attempts < MAX_ATTEMPTS) {
          fullText = container.innerText || container.textContent || '';
          if (fullText.includes(word) && fullText.length > 10) break;
          container = container.parentNode;
          attempts++;
        }

        if (!fullText) return { sentence: word };

        const sentenceBoundaries = /[。！？.!?]\s*/;
        let sentences = fullText.split(sentenceBoundaries)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        if (sentences.some(s => s.length > 500)) {
          sentences = fullText.split(/\n+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }

        for (const sentence of sentences) {
          if (sentence.includes(word)) {
            return { 
              sentence: sentence.trim(),
              context: fullText 
            };
          }
        }

        return { sentence: fullText || word };
      }
    });

    if (result?.result?.error) {
      throw new Error(result.result.error);
    }

    const sentence = result?.result?.sentence || selectedWord;
    const storageData = await chrome.storage.sync.get([
      'customPrompt',
      'checkboxStates',
      'promptRemoveWord',
      'promptRemoveSentence',
      'promptExplainSentence',
      'promptExplainText'
    ]);

    const prompt = buildPrompt(
      selectedWord, 
      sentence, 
      {
        customPrompt: storageData.customPrompt,
        promptRemoveWord: storageData.promptRemoveWord,
        promptRemoveSentence: storageData.promptRemoveSentence,
        promptExplainSentence: storageData.promptExplainSentence || defaultPromptExplainSentence,
        promptExplainText: storageData.promptExplainText || defaultPromptExplainText
      }, 
      storageData.checkboxStates || {}
    );

    await copyToClipboard(tabId, prompt);
    await openOrReusePopupWithText(prompt);

  } catch (error) {
    console.error('Error processing selected word:', error);
    chrome.notifications.create({
      type: 'basic',
      title: 'Error',
      message: error.message || 'Failed to process selection',
      iconUrl: 'icons/icon48.png'
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    customPrompt: defaultPrompt,
    checkboxStates: { 
      removeSentence: false, 
      removeWord: false, 
      explainSentence: false, 
      explainText: false 
    },
    showFloatingBtn: true,
    promptRemoveWord: defaultPromptRemoveWord,
    promptRemoveSentence: defaultPromptRemoveSentence,
    promptExplainSentence: defaultPromptExplainSentence,
    promptExplainText: defaultPromptExplainText,
    selectedService: 'chatgpt',
    deepseekCustomUrl: '',
    chatgptCustomUrl: '',
    anotherCustomUrl: ''
  };

  const currentData = await chrome.storage.sync.get(Object.keys(defaults));
  const needsUpdate = Object.keys(defaults).some(key => currentData[key] === undefined);

  if (needsUpdate) {
    await chrome.storage.sync.set(defaults);
  }

  chrome.contextMenus.create({
    id: "copySelectedWordAndSentence",
    title: "Analyze with ChatGPT",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "copySelectedWordAndSentence" || !tab?.id) return;
  
  const selectedWord = info.selectionText?.trim();
  if (!selectedWord) {
    chrome.notifications.create({
      type: 'basic',
      title: 'Error',
      message: 'No text selected.',
      iconUrl: 'icons/icon48.png'
    });
    return;
  }
  
  handleSelectedWord(tab.id, selectedWord);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'selectedText') {
    const selectedWord = message.text?.trim();
    const sentence = message.sentence?.trim();

    if (!selectedWord) {
      sendResponse({ error: 'No text selected' });
      return;
    }

    chrome.storage.sync.get([
      'customPrompt',
      'checkboxStates',
      'promptRemoveWord',
      'promptRemoveSentence',
      'promptExplainSentence',
      'promptExplainText'
    ], (data) => {
      const prompt = buildPrompt(
        selectedWord, 
        sentence, 
        {
          customPrompt: data.customPrompt,
          promptRemoveWord: data.promptRemoveWord,
          promptRemoveSentence: data.promptRemoveSentence,
          promptExplainSentence: data.promptExplainSentence || defaultPromptExplainSentence,
          promptExplainText: data.promptExplainText || defaultPromptExplainText
        }, 
        data.checkboxStates || {}
      );

      if (sender.tab?.id) {
        copyToClipboard(sender.tab.id, prompt);
        openOrReusePopupWithText(prompt);
      }
      sendResponse({ prompt });
    });

    return true;
  }
});

chrome.windows.onRemoved.addListener(windowId => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
    popupTabId = null;
  }
});