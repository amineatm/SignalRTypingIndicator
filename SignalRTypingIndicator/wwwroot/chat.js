(function () {
    const $ = sel => document.querySelector(sel);

    const els = {
        status: $("[data-status]"),
        leave: $("[data-leave]"),
        join: $("[data-join]"),
        name: $("[data-name]"),
        users: $("[data-users]"),
        msgs: $("[data-msgs]"),
        input: $("[data-input]"),
        send: $("[data-send]"),
        typing: $("[data-typing]")
    };

    let connection;
    let joined = false;
    let typingTimeout;

    function addMsg(html, cls = "") {
        const div = document.createElement("div");
        div.className = `msg ${cls}`;
        div.innerHTML = html;
        els.msgs.appendChild(div);
        els.msgs.scrollTop = els.msgs.scrollHeight;
    }

    function setConnected(on) {
        els.status.textContent = on ? "Connected" : "Disconnected";
        els.status.className = on ? "badge" : "badge danger";
        els.join.disabled = !on || joined;
        els.leave.disabled = !on || !joined;
        els.input.disabled = !on || !joined;
        els.send.disabled = !on || !joined;
    }

    function renderUsers(list) {
        els.users.innerHTML = "";
        list.forEach(u => {
            const li = document.createElement("li");
            li.textContent = u;
            li.style.padding = "4px 6px";
            li.style.borderBottom = "1px solid #eee";
            els.users.appendChild(li);
        });
    }

    function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }

    async function connect() {
        connection = new signalR.HubConnectionBuilder()
            .withUrl("/chatHub")                // same origin (no CORS)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // events
        connection.on("User Joined", u => addMsg(`<span class="sys">${u} joined</span>`));
        connection.on("User left", u => addMsg(`<span class="sys">${u} left</span>`));
        connection.on("Left Room", u => addMsg(`<span class="sys">${u} left room</span>`));

        connection.on("UserList", list => renderUsers(list));

        connection.on("Receive Message", d => {
            const t = new Date(d.timeStamp).toLocaleTimeString();
            const mine = (d.userName === (els.name.value || "").trim());
            addMsg(`<div class="bubble"><b>${d.userName}</b> • ${t}<br>${escapeHtml(d.message)}</div>`, mine ? "me" : "");
        });

        connection.on("UserTyping", t => {
            if (!t) return;
            if (t.userName === (els.name.value || "").trim()) return;
            if (t.isTyping) els.typing.textContent = `${t.userName} is typing...`;
            else if (els.typing.textContent.startsWith(t.userName)) els.typing.textContent = "";
        });

        connection.onclose(() => setConnected(false));
        connection.onreconnected(() => setConnected(true));

        await connection.start();
        setConnected(true);
    }

    function notifyTyping() {
        if (!joined) return;
        connection.invoke("SetTyping", true).catch(() => { });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => connection.invoke("SetTyping", false).catch(() => { }), 1000);
    }

    // ui events
    els.join.onclick = async () => {
        const name = (els.name.value || "").trim();
        if (!name) return;
        await connection.invoke("JoinChatRoom", name);
        joined = true;
        setConnected(true);
        // fetch current list immediately (in case broadcast raced)
        connection.invoke("GetUsers").then(renderUsers).catch(() => { });
    };

    els.leave.onclick = async () => {
        try { await connection.invoke("LeaveChatRoom"); }
        finally { joined = false; setConnected(true); els.typing.textContent = ""; }
    };

    els.send.onclick = async () => {
        const msg = (els.input.value || "").trim();
        if (!msg) return;
        await connection.invoke("SendMessage", msg);
        els.input.value = "";
        connection.invoke("SetTyping", false).catch(() => { });
    };

    els.input.addEventListener("input", notifyTyping);
    els.input.addEventListener("keydown", e => { if (e.key === "Enter") els.send.click(); });

    // auto-persist name between tabs (optional)
    const savedName = localStorage.getItem("chat_name") || "";
    els.name.value = savedName;
    els.name.addEventListener("change", () => localStorage.setItem("chat_name", els.name.value.trim()));

    connect().catch(err => addMsg(`<span class="sys">Connect failed: ${err}</span>`));
})();
