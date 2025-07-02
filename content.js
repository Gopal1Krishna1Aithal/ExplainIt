// == content.js == //
// ExplainIt - AI Chrome Extension (Upgraded)

let eli5Tooltip = null;
let explainitButton = null;
let buttonTimeout = null;
let currentTheme = localStorage.getItem('eli5-theme') || 'auto';
let isFetching = false;
let debounceTimeout = null;
let currentUtterance = null;
let isSpeaking = false;
let isPaused = false;

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function removeTooltip() {
  console.log('ExplainIt: removeTooltip called');
  if (eli5Tooltip) {
    console.log('ExplainIt: Removing tooltip from DOM');
    eli5Tooltip.remove();
    eli5Tooltip = null;
    document.removeEventListener('mousedown', handleOutsideClick, true);
    document.removeEventListener('keydown', handleEscKey, true);
  }
}

function removeButton() {
  if (explainitButton) {
    explainitButton.remove();
    explainitButton = null;
    document.removeEventListener('mousedown', handleButtonOutsideClick, true);
    clearTimeout(buttonTimeout);
  }
}

function handleOutsideClick(e) {
  // Do nothing: tooltip should never auto-close on outside click
}

function handleButtonOutsideClick(e) {
  if (explainitButton && !explainitButton.contains(e.target)) {
    removeButton();
  }
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    removeTooltip();
    removeButton();
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    isSpeaking = true;
    isPaused = false;
  }
}

function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
    isSpeaking = false;
    isPaused = false;
  }
}

function pauseSpeaking() {
  if ('speechSynthesis' in window && isSpeaking && !isPaused) {
    window.speechSynthesis.pause();
    isPaused = true;
  }
}

function resumeSpeaking() {
  if ('speechSynthesis' in window && isSpeaking && isPaused) {
    window.speechSynthesis.resume();
    isPaused = false;
  }
}

function setTooltipTheme(theme) {
  console.log('ExplainIt: setTooltipTheme called with theme:', theme);
  console.log('ExplainIt: eli5Tooltip exists:', !!eli5Tooltip);
  if (eli5Tooltip) eli5Tooltip.setAttribute('data-theme', theme);
  if (explainitButton) explainitButton.setAttribute('data-theme', theme);
  localStorage.setItem('eli5-theme', theme);
  console.log('ExplainIt: Theme set successfully');
}

function positionTooltip(tooltip, rect) {
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  let top = rect.bottom + scrollY + 8;
  let left = rect.left + scrollX;
  setTimeout(() => {
    const tipRect = tooltip.getBoundingClientRect();
    if (left + tipRect.width > window.innerWidth - 16) {
      left = window.innerWidth - tipRect.width - 16;
    }
    if (top + tipRect.height > window.innerHeight - 16) {
      top = rect.top + scrollY - tipRect.height - 16;
    }
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }, 0);
}

function positionButton(button, rect) {
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  let top = rect.top + scrollY - 36;
  let left = rect.left + scrollX + (rect.width / 2) - 18;
  setTimeout(() => {
    const btnRect = button.getBoundingClientRect();
    if (left + btnRect.width > window.innerWidth - 8) {
      left = window.innerWidth - btnRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = rect.bottom + scrollY + 8;
    button.style.top = `${top}px`;
    button.style.left = `${left}px`;
  }, 0);
}

// Helper: Fetch explanation from OpenAI or Groq API via background script
async function fetchExplanation(text) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'EXPLAIN_TEXT', text }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('ExplainIt Error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response?.explanation || null);
        }
      });
    } catch (error) {
      console.error('ExplainIt Error:', error);
      resolve(null);
    }
  });
}

window.addEventListener('mouseup', (event) => {
  // Prevent closing tooltip or button if click is inside them
  if (
    (eli5Tooltip && eli5Tooltip.contains(event.target)) ||
    (explainitButton && explainitButton.contains(event.target))
  ) {
    return;
  }
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      removeButton();
      return;
    }
    if (isFetching) {
      removeButton();
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      removeButton();
      return;
    }
    removeTooltip();
    removeButton();
    explainitButton = document.createElement('button');
    explainitButton.className = 'explainit-floating-btn';
    explainitButton.setAttribute('aria-label', 'Explain selected text');
    explainitButton.setAttribute('tabindex', '0');
    explainitButton.setAttribute('data-theme', currentTheme === 'auto' ? getSystemTheme() : currentTheme);
    explainitButton.innerHTML = '💡';
    explainitButton.style.position = 'absolute';
    explainitButton.style.zIndex = 2147483647;
    explainitButton.style.opacity = '0';
    document.body.appendChild(explainitButton);
    positionButton(explainitButton, rect);
    setTimeout(() => { if (explainitButton) explainitButton.style.opacity = '1'; }, 10);
    buttonTimeout = setTimeout(removeButton, 5000);
    document.addEventListener('mousedown', handleButtonOutsideClick, true);
    document.addEventListener('keydown', handleEscKey, true);
    explainitButton.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        explainitButton.click();
      }
    };
    explainitButton.onclick = async () => {
      removeButton();
      console.log('ExplainIt: Creating tooltip for:', text);
      eli5Tooltip = document.createElement('div');
      eli5Tooltip.className = 'eli5-tooltip';
      eli5Tooltip.innerHTML = `
        <div class="eli5-header">
          <span class="eli5-title">ExplainIt</span>
          <button class="eli5-theme-toggle" title="Toggle theme">🌙</button>
          <button class="eli5-close" title="Close">❌</button>
        </div>
        <div class="eli5-body">
          <div class="eli5-loading">Explaining "<b>${text.replace(/</g, '&lt;')}</b>"...</div>
        </div>
        <div class="eli5-actions" style="display:none">
          <button class="eli5-copy" title="Copy">📋</button>
          <button class="eli5-listen" title="Listen">🗣️</button>
          <button class="eli5-stop" title="Stop">⏹️</button>
        </div>
        <div class="eli5-pointer"></div>
      `;
      document.body.appendChild(eli5Tooltip);
      eli5Tooltip.classList.add('eli5-show');
      setTooltipTheme(currentTheme === 'auto' ? getSystemTheme() : currentTheme);
      positionTooltip(eli5Tooltip, rect);
      isFetching = true;
      console.log('ExplainIt: Starting API call...');
      const explanation = await fetchExplanation(text);
      console.log('ExplainIt: API response:', explanation ? 'success' : 'failed');
      isFetching = false;
      const body = eli5Tooltip.querySelector('.eli5-body');
      if (!explanation) {
        console.log('ExplainIt: Showing error message');
        body.innerHTML = `
          <div class="eli5-error">
            ⚠️ Couldn't fetch explanation. Please check your connection or API key.
          </div>
        `;
        eli5Tooltip.querySelector('.eli5-actions').style.display = 'none';
      } else {
        console.log('ExplainIt: Showing explanation');
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(text)}+explained`;
        const finalExplanation = `${explanation}<br><a href="${searchUrl}" target="_blank" style="color:inherit;text-decoration:underline;">Read more about it here →</a>`;
        body.innerHTML = `<div class="eli5-explanation">${finalExplanation.replace(/\n/g, '<br>')}</div>`;
        eli5Tooltip.querySelector('.eli5-actions').style.display = 'flex';
        eli5Tooltip.querySelector('.eli5-copy').onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          copyToClipboard(explanation);
        };
        // Audio controls
        const listenBtn = eli5Tooltip.querySelector('.eli5-listen');
        const stopBtn = eli5Tooltip.querySelector('.eli5-stop');
        listenBtn.textContent = '🗣️';
        let utter = null;
        listenBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSpeaking && !isPaused) {
            // Create utterance only once per tooltip
            if (!utter) {
              utter = new SpeechSynthesisUtterance(explanation);
              utter.onend = () => {
                listenBtn.textContent = '🗣️';
                isSpeaking = false;
                isPaused = false;
              };
              utter.onerror = () => {
                listenBtn.textContent = '🗣️';
                isSpeaking = false;
                isPaused = false;
              };
            }
            window.speechSynthesis.speak(utter);
            isSpeaking = true;
            isPaused = false;
            listenBtn.textContent = '⏸️';
          } else if (isSpeaking && !isPaused) {
            window.speechSynthesis.pause();
            isPaused = true;
            listenBtn.textContent = '▶️';
          } else if (isSpeaking && isPaused) {
            window.speechSynthesis.resume();
            isPaused = false;
            listenBtn.textContent = '⏸️';
          }
        };
        stopBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.speechSynthesis.cancel();
          isSpeaking = false;
          isPaused = false;
          listenBtn.textContent = '🗣️';
          utter = null;
        };
      }
      eli5Tooltip.querySelector('.eli5-theme-toggle').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('ExplainIt: Theme toggle clicked, current theme:', currentTheme);
        if (currentTheme === 'auto') currentTheme = getSystemTheme() === 'dark' ? 'light' : 'dark';
        else if (currentTheme === 'light') currentTheme = 'dark';
        else currentTheme = 'light';
        console.log('ExplainIt: New theme:', currentTheme);
        setTooltipTheme(currentTheme);
        console.log('ExplainIt: Theme applied, tooltip should still be visible');
      };
      eli5Tooltip.querySelector('.eli5-close').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.speechSynthesis.cancel();
        isSpeaking = false;
        isPaused = false;
        removeTooltip();
      };
    };
  }, 300);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'auto') setTooltipTheme(getSystemTheme());
});
