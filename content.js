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
let tooltipClosing = false;

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function removeTooltip() {
  if (!eli5Tooltip || tooltipClosing) return;
  tooltipClosing = true;
  eli5Tooltip.classList.remove('eli5-tooltip--visible');
  eli5Tooltip.classList.add('eli5-tooltip--closing');
  // Remove listeners immediately to prevent flicker/reopen
  document.removeEventListener('mousedown', handleOutsideClick, true);
  document.removeEventListener('keydown', handleEscKey, true);
  setTimeout(() => {
    if (eli5Tooltip) {
      eli5Tooltip.remove();
      eli5Tooltip = null;
    }
    tooltipClosing = false;
  }, 250); // Match the CSS animation duration
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
  // Only close if click is outside the tooltip and not on floating button
  if (
    eli5Tooltip &&
    !eli5Tooltip.contains(e.target) &&
    (!explainitButton || !explainitButton.contains(e.target))
  ) {
    removeTooltip();
  }
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
  if (eli5Tooltip) {
    eli5Tooltip.setAttribute('data-theme', theme);
    // Also update the icon if the button exists
    const themeToggleBtn = eli5Tooltip.querySelector && eli5Tooltip.querySelector('.eli5-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }
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
          <button class="eli5-pin-btn" title="Pin tooltip">📌</button>
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
      // Add refresh button as the first button in the actions area
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'eli5-refresh-btn';
      refreshBtn.title = 'Regenerate explanation';
      refreshBtn.innerHTML = '🔄';
      const actions = eli5Tooltip.querySelector('.eli5-actions');
      if (actions) {
        actions.insertBefore(refreshBtn, actions.firstChild);
        // Add animation class to all action buttons
        refreshBtn.classList.add('eli5-action-animate');
        // Font size controls
        const decBtn = document.createElement('button');
        decBtn.className = 'eli5-font-dec';
        decBtn.title = 'Decrease font size';
        decBtn.textContent = 'A-';
        decBtn.classList.add('eli5-action-animate');
        const incBtn = document.createElement('button');
        incBtn.className = 'eli5-font-inc';
        incBtn.title = 'Increase font size';
        incBtn.textContent = 'A+';
        incBtn.classList.add('eli5-action-animate');
        actions.appendChild(decBtn);
        actions.appendChild(incBtn);
        // Font size logic
        let fontSize = 15;
        const minFont = 11, maxFont = 28;
        function setFontSize(size) {
          fontSize = Math.max(minFont, Math.min(maxFont, size));
          eli5Tooltip.style.fontSize = fontSize + 'px';
        }
        decBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setFontSize(fontSize - 2);
        };
        incBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setFontSize(fontSize + 2);
        };
        setFontSize(fontSize);
      }

      let lastSelectedText = text;
      refreshBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Pulse animation
        refreshBtn.classList.remove('pulse');
        void refreshBtn.offsetWidth; // force reflow
        refreshBtn.classList.add('pulse');
        const body = eli5Tooltip.querySelector('.eli5-body');
        const actions = eli5Tooltip.querySelector('.eli5-actions');
        // Show spinner and loading text
        refreshBtn.innerHTML = '<span class="eli5-refresh-spinner"></span>';
        body.innerHTML = '<div class="eli5-loading">Regenerating...</div>';
        if (actions) actions.style.display = 'none';
        isFetching = true;
        const explanation = await fetchExplanation(lastSelectedText);
        isFetching = false;
        if (!explanation) {
          body.innerHTML = `<div class="eli5-error">⚠️ Couldn\'t fetch explanation. Please check your connection or API key.</div>`;
          if (actions) actions.style.display = 'none';
        } else {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(lastSelectedText)}+explained`;
          const finalExplanation = `${explanation}<br><a href="${searchUrl}" target="_blank" style="color:inherit;text-decoration:underline;">Read more about it here →</a>`;
          body.innerHTML = `<div class="eli5-explanation">${finalExplanation.replace(/\n/g, '<br>')}</div>`;
          if (actions) actions.style.display = 'flex';
        }
        refreshBtn.innerHTML = '🔄';
      };
      // Make tooltip draggable by header
      const header = eli5Tooltip.querySelector('.eli5-header');
      let dragOffsetX = 0, dragOffsetY = 0, isDragging = false;
      function onDragStart(e) {
        if (e.type === 'mousedown' && (e.button !== 0)) return; // Only left mouse
        isDragging = true;
        const rect = eli5Tooltip.getBoundingClientRect();
        dragOffsetX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        dragOffsetY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, {passive:false});
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
        eli5Tooltip.style.transition = 'none';
      }
      function onDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - dragOffsetX;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - dragOffsetY;
        eli5Tooltip.style.left = x + 'px';
        eli5Tooltip.style.top = y + 'px';
        eli5Tooltip.style.right = '';
        eli5Tooltip.style.bottom = '';
        eli5Tooltip.style.position = 'absolute';
      }
      function onDragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
        eli5Tooltip.style.transition = '';
      }
      header.style.cursor = 'move';
      header.addEventListener('mousedown', onDragStart);
      header.addEventListener('touchstart', onDragStart, {passive:false});
      // Trigger slide-in animation
      setTimeout(() => {
        eli5Tooltip.classList.add('eli5-tooltip--visible');
        eli5Tooltip.classList.remove('eli5-tooltip--closing');
        // Add listeners for outside click and Esc key
        document.addEventListener('mousedown', handleOutsideClick, true);
        document.addEventListener('keydown', handleEscKey, true);
      }, 10);
      setTooltipTheme(currentTheme === 'auto' ? getSystemTheme() : currentTheme);
      // Set correct icon for theme toggle
      const themeToggleBtn = eli5Tooltip.querySelector('.eli5-theme-toggle');
      function updateThemeToggleIcon(theme) {
        themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
      updateThemeToggleIcon(currentTheme === 'auto' ? getSystemTheme() : currentTheme);
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
          // Only copy the explanation text, not the URL
          let explanationText = explanation;
          // Remove any trailing URL if present
          explanationText = explanationText.replace(/<br><a [^>]+>.*?<\/a>/gi, '').replace(/\n?Read more about it here.*/i, '').trim();
          copyToClipboard(explanationText);
          // Show a temporary popup/tooltip near the copy button
          const copyBtn = eli5Tooltip.querySelector('.eli5-copy');
          let feedback = document.createElement('div');
          feedback.textContent = 'Copied!';
          feedback.style.position = 'absolute';
          feedback.style.bottom = '36px';
          feedback.style.right = '0';
          feedback.style.background = 'rgba(60,60,60,0.95)';
          feedback.style.color = '#fff';
          feedback.style.padding = '4px 12px';
          feedback.style.borderRadius = '8px';
          feedback.style.fontSize = '13px';
          feedback.style.zIndex = '9999';
          feedback.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)';
          feedback.style.pointerEvents = 'none';
          feedback.style.opacity = '0';
          feedback.style.transition = 'opacity 0.18s';
          copyBtn.parentElement.appendChild(feedback);
          setTimeout(() => { feedback.style.opacity = '1'; }, 10);
          setTimeout(() => { feedback.style.opacity = '0'; }, 1200);
          setTimeout(() => { feedback.remove(); }, 1500);
        };
        // Audio controls
        const listenBtn = eli5Tooltip.querySelector('.eli5-listen');
        const stopBtn = eli5Tooltip.querySelector('.eli5-stop');
        listenBtn.textContent = '🗣️';
        let utter = null;
        // Hide stop button by default
        stopBtn.style.display = 'none';
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
                stopBtn.style.display = 'none';
              };
              utter.onerror = () => {
                listenBtn.textContent = '🗣️';
                isSpeaking = false;
                isPaused = false;
                stopBtn.style.display = 'none';
              };
            }
            window.speechSynthesis.speak(utter);
            isSpeaking = true;
            isPaused = false;
            listenBtn.textContent = '⏸️';
            stopBtn.style.display = '';
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
          stopBtn.style.display = 'none';
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
        updateThemeToggleIcon(currentTheme === 'auto' ? getSystemTheme() : currentTheme);
        console.log('ExplainIt: Theme applied, tooltip should still be visible');
      };
      // Pin/unpin logic
      const pinBtn = eli5Tooltip.querySelector('.eli5-pin-btn');
      let isPinned = false;
      function updatePinUI() {
        if (isPinned) {
          pinBtn.classList.add('pinned');
          pinBtn.title = 'Unpin tooltip';
          eli5Tooltip.classList.add('eli5-pinned');
        } else {
          pinBtn.classList.remove('pinned');
          pinBtn.title = 'Pin tooltip';
          eli5Tooltip.classList.remove('eli5-pinned');
        }
      }
      pinBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isPinned = !isPinned;
        updatePinUI();
      };
      updatePinUI();

      // Override close logic if pinned
      const origRemoveTooltip = removeTooltip;
      function customRemoveTooltip(force) {
        if (isPinned && !force) return;
        origRemoveTooltip();
      }
      removeTooltip = customRemoveTooltip;

      // Prevent outside click/Esc close if pinned
      function customHandleOutsideClick(e) {
        if (isPinned) return;
        if (
          eli5Tooltip &&
          !eli5Tooltip.contains(e.target) &&
          (!explainitButton || !explainitButton.contains(e.target))
        ) {
          removeTooltip();
        }
      }
      function customHandleEscKey(e) {
        if (isPinned) return;
        if (e.key === 'Escape') {
          removeTooltip();
          removeButton();
        }
      }
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleEscKey, true);
      document.addEventListener('mousedown', customHandleOutsideClick, true);
      document.addEventListener('keydown', customHandleEscKey, true);
      // Always ensure close button works, even after drag/pin
      const closeBtn = eli5Tooltip.querySelector('.eli5-close');
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isPinned = false;
        updatePinUI();
        window.speechSynthesis.cancel();
        isSpeaking = false;
        isPaused = false;
        // Always force close
        removeTooltip(true);
      };
      eli5Tooltip.querySelector('.eli5-theme-toggle').classList.add('eli5-action-animate');
      eli5Tooltip.querySelector('.eli5-close').classList.add('eli5-action-animate');
      // After explanation loads, add animation class to copy/listen/stop
      if (actions) {
        actions.querySelector('.eli5-copy').classList.add('eli5-action-animate');
        actions.querySelector('.eli5-listen').classList.add('eli5-action-animate');
        actions.querySelector('.eli5-stop').classList.add('eli5-action-animate');
      }
    };
  }, 300);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'auto') setTooltipTheme(getSystemTheme());
});
