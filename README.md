 🧠 ExplainIt - Chrome Extension

**ExplainIt** is a lightweight Chrome extension that lets users select text on any webpage and get a beginner-friendly AI explanation — in just one click.

### ✨ Features
- 💡 Floating bulb appears on selecting text
- 📘 Shows simplified explanation in a clean tooltip
- 🗣️ Listen to the explanation with built-in voice
- 🌙 Switch between Light, Dark, or Auto theme
- 🔁 Retry if explanation fails
- 🧼 Tooltip closes on outside click or ESC

### 🛠️ How It Works
- Uses OpenAI / Groq API (LLM) in the background
- Sends selected text to the model with a clear prompt
- Shows result in a styled popup (like a tooltip)
- Everything runs in `content.js` and `background.js`

### To load the extension in your browser:

 - Open chrome://extensions (or Brave/Edge equivalent)
 - Enable Developer Mode
 - Click Load unpacked
 - Select the folder where the code is saved

### Note:
  - Add your API key in placeholder (in background.js)

### File Structure 

  explainit-extension/
   - content.js         // Tooltip logic, UI interactions
   -  background.js      // Handles API requests
   -  manifest.json      // Extension config & permissions
  -  style.css          // Tooltip styling
  -  icons/             // Favicon and extension icons (16x16, 32x32, 512x512)
  -  README.md
             
### 🧠 Built With

 - JavaScript (Vanilla)
 - Chrome Extension APIs
 - HTML + CSS
- Groq / OpenAI LLM APIs

### Made with 💙 by GK
