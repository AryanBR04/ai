// CONFIG
var MODEL = "microsoft/Phi-3-mini-4k-instruct";
var API_URL = "/api/chat";

// STATE
var messageHistory = [];
var sessions = [];
var sessId = null;
var busy = false;

// DOM
var sidebar = document.getElementById("sidebar");
var histList = document.getElementById("historyList");
var newBtn = document.getElementById("newChatBtn");
var closeBtn = document.getElementById("sidebarClose");
var openBtn = document.getElementById("sidebarOpen");
var clearBtn = document.getElementById("clearBtn");
var messages = document.getElementById("messages");
var chatMsgs = document.getElementById("chatMessages");
var welcome = document.getElementById("welcome");
var inp = document.getElementById("userInput");
var sendBtn = document.getElementById("sendBtn");
var contextMenu = document.getElementById("contextMenu");
var deleteBtn = document.getElementById("deleteChatItem");
var selectedSessionId = null;

var ov = document.createElement("div");
ov.className = "overlay";
document.body.appendChild(ov);

function hideSidebar() {
    sidebar.classList.add("hidden");
    openBtn.classList.add("show");
    ov.classList.remove("on");
}
function showSidebar() {
    sidebar.classList.remove("hidden");
    openBtn.classList.remove("show");
}

closeBtn.addEventListener("click", hideSidebar);
openBtn.addEventListener("click", function () {
    showSidebar();
    if (window.innerWidth <= 768) ov.classList.add("on");
});
ov.addEventListener("click", hideSidebar);

function newChat() {
    if (messageHistory.length > 0) saveSession();
    messageHistory = [];
    sessId = String(Date.now());
    chatMsgs.innerHTML = "";
    welcome.classList.remove("gone");
    inp.value = "";
    doResize();
    setBtn();
}
newBtn.addEventListener("click", newChat);
clearBtn.addEventListener("click", newChat);

function saveSession() {
    if (!sessId || !messageHistory.length) return;
    var t = messageHistory[0].content.slice(0, 40) + "...";
    var ex = sessions.find(function (s) { return s.id === sessId; });
    if (ex) { ex.h = messageHistory.slice(); ex.t = t; }
    else { sessions.unshift({ id: sessId, t: t, h: messageHistory.slice() }); }
    renderSessions();
    try { localStorage.setItem("nc", JSON.stringify(sessions.slice(0, 20))); } catch (e) { }
}

function loadStored() {
    try {
        var x = localStorage.getItem("nc");
        if (x) sessions = JSON.parse(x);
    } catch (e) { }
    renderSessions();
}

function renderSessions() {
    histList.innerHTML = "";
    sessions.forEach(function (s) {
        var b = document.createElement("button");
        b.className = "hist-item" + (s.id === sessId ? " active" : "");
        b.textContent = s.t;
        b.title = s.t;
        b.addEventListener("click", function () { loadSession(s.id); });

        // Add right-click (context menu) listener
        b.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            selectedSessionId = s.id;
            showContextMenu(e.pageX, e.pageY);
        });

        histList.appendChild(b);
    });
}

function showContextMenu(x, y) {
    contextMenu.style.display = "block";
    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
}

function hideContextMenu() {
    contextMenu.style.display = "none";
    selectedSessionId = null;
}

// Global click to hide context menu
document.addEventListener("click", hideContextMenu);
document.addEventListener("contextmenu", function (e) {
    if (!e.target.classList.contains('hist-item')) hideContextMenu();
});

deleteBtn.addEventListener("click", function () {
    if (selectedSessionId) {
        deleteSession(selectedSessionId);
    }
});

function deleteSession(id) {
    sessions = sessions.filter(function (s) { return s.id !== id; });
    try { localStorage.setItem("nc", JSON.stringify(sessions.slice(0, 20))); } catch (e) { }

    if (sessId === id) {
        newChat();
    } else {
        renderSessions();
    }
}

function loadSession(id) {
    if (messageHistory.length && sessId !== id) saveSession();
    var s = sessions.find(function (x) { return x.id === id; });
    if (!s) return;
    sessId = id;
    messageHistory = s.h.slice();
    chatMsgs.innerHTML = "";
    welcome.classList.add("gone");
    messageHistory.forEach(function (m) {
        if (m.role === "user") addUserBubble(m.content);
        else if (m.role === "assistant") addAIBubble(m.content, true);
    });
    scrollDown();
    renderSessions();
    if (window.innerWidth <= 768) hideSidebar();
}

inp.addEventListener("input", function () { doResize(); setBtn(); });
inp.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) doSend();
    }
});

function doResize() {
    inp.style.height = "auto";
    inp.style.height = Math.min(inp.scrollHeight, 200) + "px";
}
function setBtn() { sendBtn.disabled = inp.value.trim() === "" || busy; }
sendBtn.addEventListener("click", doSend);

async function doSend() {
    var text = inp.value.trim();
    if (!text || busy) return;
    welcome.classList.add("gone");
    addUserBubble(text);
    messageHistory.push({ role: "user", content: text });
    inp.value = "";
    doResize();
    busy = true;
    setBtn();
    var dots = addTypingRow();
    try {
        var reply = await callAPI(messageHistory);
        dots.remove();
        addAIBubble(reply, false);
        messageHistory.push({ role: "assistant", content: reply });
        saveSession();
    } catch (err) {
        dots.remove();
        addErrorRow(err.message || "Something went wrong.");
    } finally {
        busy = false;
        setBtn();
    }
}

async function callAPI(msgs) {
    var systemMsg = "You are NeuraChat, a helpful AI assistant. Provide clear, friendly, and accurate answers. Help with coding, writing, math, analysis, and creative tasks.";
    var body = JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemMsg }].concat(msgs),
        max_tokens: 600,
        temperature: 0.7,
        stream: false
    });

    var attempt = async function () {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 55000); // 55s timeout
        try {
            var r = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body,
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!r.ok) {
                var d = await r.json().catch(function () { return {}; });
                if (r.status === 503) return null;
                if (r.status === 401) throw new Error("Invalid API key.");
                if (r.status === 429) throw new Error("Rate limit hit. Wait a moment and retry.");
                throw new Error(d.error || ("API error " + r.status));
            }
            return r;
        } catch (e) {
            clearTimeout(timer);
            if (e.name === "AbortError") throw new Error("Request timed out. The AI model is loading — please try again in 30 seconds.");
            throw e;
        }
    };

    var res = await attempt();
    if (!res) {
        await new Promise(function (r) { setTimeout(r, 8000); });
        res = await attempt();
        if (!res) throw new Error("Model is warming up. Please try again in 30 seconds.");
    }

    var data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim() || "No response generated.";
    }
    if (data.error) throw new Error(typeof data.error === "string" ? data.error : data.error.message || "API error.");
    throw new Error("Unexpected API response.");
}

// ---- UI builders (DOM-only, no innerHTML with closing tags) ----

function addUserBubble(text) {
    var row = document.createElement("div"); row.className = "msg-row user";
    var bubble = document.createElement("div"); bubble.className = "msg-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMsgs.appendChild(row);
    scrollDown();
}

function addAIBubble(text, isInstant) {
    var row = document.createElement("div"); row.className = "msg-row ai";
    var bubble = document.createElement("div"); bubble.className = "msg-bubble";
    var av = document.createElement("div"); av.className = "ai-avatar"; av.textContent = "N";
    var cont = document.createElement("div"); cont.className = "ai-content";

    // Copy Button
    var copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = "<span>Copy</span>";
    copyBtn.addEventListener("click", function () {
        copyToClipboard(text, copyBtn);
    });

    bubble.appendChild(av);
    bubble.appendChild(cont);
    bubble.appendChild(copyBtn);
    row.appendChild(bubble);
    chatMsgs.appendChild(row);

    if (isInstant) {
        buildContent(cont, text);
    } else {
        typewriter(cont, text);
    }
    scrollDown();
}

function typewriter(container, text) {
    var words = text.split(" ");
    var i = 0;
    var currentText = "";

    var cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    container.appendChild(cursor);

    function next() {
        if (i < words.length) {
            currentText += (i === 0 ? "" : " ") + words[i];
            container.innerHTML = ""; // Clear for re-build
            buildContent(container, currentText);
            container.appendChild(cursor);
            i++;
            scrollDown();
            setTimeout(next, 15 + Math.random() * 25);
        } else {
            cursor.remove();
        }
    }
    next();
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
        var original = btn.innerHTML;
        btn.innerHTML = "<span>Copied!</span>";
        btn.classList.add("copied");
        setTimeout(function () {
            btn.innerHTML = original;
            btn.classList.remove("copied");
        }, 2000);
    });
}

function buildContent(container, text) {
    var lines = text.split("\n");
    var para = [];
    var inCode = false;
    var codeBuf = [];

    function flushPara() {
        if (!para.length) return;
        var joined = para.join("\n").trim();
        para = [];
        if (!joined) return;
        var blocks = joined.split("\n\n");
        blocks.forEach(function (block) {
            block = block.trim();
            if (!block) return;
            var isList = block.split("\n").every(function (l) { return /^[-*] /.test(l); });
            if (isList) {
                var ul = document.createElement("ul");
                block.split("\n").forEach(function (l) {
                    var li = document.createElement("li");
                    li.textContent = l.replace(/^[-*] /, "");
                    ul.appendChild(li);
                });
                container.appendChild(ul);
            } else {
                var p = document.createElement("p");
                p.textContent = block;
                container.appendChild(p);
            }
        });
    }

    lines.forEach(function (line) {
        if (line.startsWith("```")) {
            if (!inCode) {
                flushPara();
                inCode = true;
                codeBuf = [];
            } else {
                var pre = document.createElement("pre");
                var code = document.createElement("code");
                code.textContent = codeBuf.join("\n");
                pre.appendChild(code);
                container.appendChild(pre);
                inCode = false;
                codeBuf = [];
            }
        } else if (inCode) {
            codeBuf.push(line);
        } else {
            para.push(line);
        }
    });

    flushPara();
    if (inCode && codeBuf.length) {
        var pre = document.createElement("pre");
        var code = document.createElement("code");
        code.textContent = codeBuf.join("\n");
        pre.appendChild(code);
        container.appendChild(pre);
    }
}

function addTypingRow() {
    var row = document.createElement("div"); row.className = "msg-row ai";
    var bubble = document.createElement("div"); bubble.className = "msg-bubble";
    var av = document.createElement("div"); av.className = "ai-avatar"; av.textContent = "N";
    var cont = document.createElement("div"); cont.className = "ai-content";
    var dots = document.createElement("div"); dots.className = "typing-dots";
    for (var i = 0; i < 3; i++) dots.appendChild(document.createElement("span"));
    cont.appendChild(dots);
    bubble.appendChild(av);
    bubble.appendChild(cont);
    row.appendChild(bubble);
    chatMsgs.appendChild(row);
    scrollDown();
    return row;
}

function addErrorRow(msg) {
    var row = document.createElement("div"); row.className = "msg-row ai";
    var bubble = document.createElement("div"); bubble.className = "msg-bubble";
    var av = document.createElement("div"); av.className = "ai-avatar";
    av.textContent = "!";
    av.style.background = "linear-gradient(135deg,#ff6b6b,#ee5a24)";
    var cont = document.createElement("div"); cont.className = "ai-content";
    var err = document.createElement("div"); err.className = "error-msg";
    err.textContent = msg;
    cont.appendChild(err);
    bubble.appendChild(av);
    bubble.appendChild(cont);
    row.appendChild(bubble);
    chatMsgs.appendChild(row);
    scrollDown();
}

function scrollDown() {
    messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
}

function useSuggestion(btn) {
    var b = btn.querySelector("b").textContent;
    var s = btn.querySelector("span").textContent;
    inp.value = b + " - " + s;
    doResize();
    setBtn();
    inp.focus();
}

// INIT
sessId = String(Date.now());
loadStored();
setBtn();
if (window.innerWidth <= 768) hideSidebar();
