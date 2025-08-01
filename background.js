// background.js
// Handles API requests securely for ExplainIt extension

const OPENAI_API_KEY = 'ADD YOUR API KEY HERE'; // <-- Replace with your key or use chrome.storage for distribution
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You're an AI assistant for a Chrome extension that explains technical words in 4 beginner-level sentences. Your style must be: - Clear and friendly (not robotic) - No jargon or advanced terms - End with real-life examples - Final sentence: "Read more about it here → [link]". If the term is ambiguous, choose the most common meaning.`;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXPLAIN_TEXT') {
    console.log('ExplainIt Background: Received request for text:', msg.text);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Use a Groq-compatible model
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: msg.text }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    })
      .then(res => {
        console.log('ExplainIt Background: API response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('ExplainIt Background: API response data:', data);
        const explanation = data.choices?.[0]?.message?.content;
        if (!explanation) {
          throw new Error('No explanation received from API');
        }
        console.log('ExplainIt Background: Sending explanation back');
        sendResponse({ explanation: explanation });
      })
      .catch(error => {
        console.error('ExplainIt Background API Error:', error);
        sendResponse({ explanation: null, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
}); 
