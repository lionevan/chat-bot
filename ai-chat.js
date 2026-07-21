/* ===========================================================
   ai-chat.js — בוט AI אמיתי (מבוסס קלוד) לטברנה יאסו רודוס
   שולח כל שאלה חופשית ל-Apps Script שמדבר עם Anthropic API.

   *** לפני השימוש: החלף את הכתובת למטה בלינק ה-Web App שלך ***
   =========================================================== */

(function () {

  /* ---------- 1. הגדרות ---------- */
  // הדבק כאן את ה-URL שקיבלת מ-Deploy -> Web app ב-Apps Script
  const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyhbKROZqSIWt3uIiTArumCg2LbOhZwYKuW7ejY5qDiYfB7MD0wQ2d5i31_IJ4UtFtr/exec";

  const WELCOME_MSG = "שלום! 👋 אני העוזר הדיגיטלי של טברנה יאסו רודוס. אפשר לשאול אותי כל שאלה על המסעדה, השעות, ההזמנות, התפריט ועוד.";
  const ERROR_MSG = "מצטערים, הייתה בעיה בחיבור. אפשר לנסות שוב או ליצור קשר ישירות דרך עמוד 'צור קשר'.";

  /* ---------- 2. עיצוב (זהה לבוט הפשוט, כדי לשמור על עקביות) ---------- */
  const style = document.createElement("style");
  style.textContent = `
    #ytb-ai-btn {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg,#0069a8,#003b66);
      color: #fff;
      border: none;
      font-size: 26px;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,30,55,.35);
      z-index: 999;
    }
    #ytb-ai-window {
      position: fixed;
      bottom: 90px;
      left: 20px;
      width: 320px;
      max-width: calc(100vw - 40px);
      height: 460px;
      max-height: 72vh;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 35px rgba(0,0,0,.25);
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
      direction: rtl;
      z-index: 999;
    }
    #ytb-ai-window.open { display: flex; }
    #ytb-ai-header {
      background: linear-gradient(to bottom,#0069a8,#003b66);
      color: #fff;
      padding: 14px 16px;
      font-size: 16px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    #ytb-ai-header span { cursor: pointer; font-size: 20px; }
    #ytb-ai-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      background: #f7f7f7;
    }
    .ytb-ai-msg { margin-bottom: 10px; display: flex; }
    .ytb-ai-msg.bot { justify-content: flex-start; }
    .ytb-ai-msg.user { justify-content: flex-end; }
    .ytb-ai-bubble {
      max-width: 82%;
      padding: 9px 12px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .ytb-ai-msg.bot .ytb-ai-bubble { background: #eaf3fb; color: #222; border-bottom-left-radius: 4px; }
    .ytb-ai-msg.user .ytb-ai-bubble { background: #0069a8; color: #fff; border-bottom-right-radius: 4px; }
    .ytb-ai-typing { color: #888; font-size: 13px; padding: 4px 12px; }
    #ytb-ai-input-row {
      display: flex;
      border-top: 1px solid #eee;
      padding: 8px;
      gap: 6px;
      flex-shrink: 0;
    }
    #ytb-ai-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 14px;
      outline: none;
    }
    #ytb-ai-send {
      background: #0069a8;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 16px;
      cursor: pointer;
      flex-shrink: 0;
    }
    #ytb-ai-send:disabled { opacity: .5; cursor: default; }
  `;
  document.head.appendChild(style);

  /* ---------- 3. בניית ה-HTML ---------- */
  const btn = document.createElement("button");
  btn.id = "ytb-ai-btn";
  btn.setAttribute("aria-label", "פתח צ׳אט AI");
  btn.textContent = "🤖";
  document.body.appendChild(btn);

  const win = document.createElement("div");
  win.id = "ytb-ai-window";
  win.innerHTML = `
    <div id="ytb-ai-header">
      <span id="ytb-ai-close">×</span>
      <span>שאלו אותי כל דבר – יאסו רודוס</span>
    </div>
    <div id="ytb-ai-body"></div>
    <div id="ytb-ai-input-row">
      <input id="ytb-ai-input" type="text" placeholder="כתוב שאלה...">
      <button id="ytb-ai-send">➤</button>
    </div>
  `;
  document.body.appendChild(win);

  const body = win.querySelector("#ytb-ai-body");
  const input = win.querySelector("#ytb-ai-input");
  const sendBtn = win.querySelector("#ytb-ai-send");

  /* ---------- 4. ניהול היסטוריית שיחה (בזיכרון בלבד, לא נשמר) ---------- */
  let history = [];
  let waiting = false;

  function addBubble(text, from) {
    const row = document.createElement("div");
    row.className = "ytb-ai-msg " + from;
    const bubble = document.createElement("div");
    bubble.className = "ytb-ai-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  function setTyping(on) {
    let el = body.querySelector(".ytb-ai-typing");
    if (on) {
      if (!el) {
        el = document.createElement("div");
        el.className = "ytb-ai-typing";
        el.textContent = "כותב תשובה...";
        body.appendChild(el);
      }
    } else if (el) {
      el.remove();
    }
    body.scrollTop = body.scrollHeight;
  }

  async function sendMessage(text) {
    if (!text.trim() || waiting) return;
    waiting = true;
    sendBtn.disabled = true;
    input.value = "";

    addBubble(text, "user");
    setTyping(true);

    try {
      const reply = await jsonpRequest(text, history);

      setTyping(false);
      addBubble(reply || ERROR_MSG, "bot");

      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: reply || "" });
      if (history.length > 12) history = history.slice(-12);

    } catch (err) {
      setTyping(false);
      addBubble(ERROR_MSG, "bot");
    }

    waiting = false;
    sendBtn.disabled = false;
  }

  // שולח בקשה בשיטת JSONP (תג <script>) כדי לעקוף לגמרי הגבלות CORS של Apps Script
  function jsonpRequest(message, historyArr) {
    return new Promise((resolve, reject) => {
      const callbackName = "ytbAiCb_" + Date.now();
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("timeout"));
      }, 20000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (data) {
        cleanup();
        resolve(data && data.reply);
      };

      const params = new URLSearchParams({
        message: message,
        history: JSON.stringify(historyArr),
        callback: callbackName
      });

      const script = document.createElement("script");
      script.src = BACKEND_URL + "?" + params.toString();
      script.onerror = () => {
        cleanup();
        reject(new Error("script load error"));
      };
      document.body.appendChild(script);
    });
  }

  sendBtn.onclick = () => sendMessage(input.value);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage(input.value);
  });

  btn.onclick = () => {
    win.classList.toggle("open");
    if (win.classList.contains("open") && body.children.length === 0) {
      addBubble(WELCOME_MSG, "bot");
    }
  };
  win.querySelector("#ytb-ai-close").onclick = () => win.classList.remove("open");

})();
