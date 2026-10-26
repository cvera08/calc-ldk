(() => {
  const KEY = "calc-casa-v1";
  const { show, isNeg, fmt } = Calc;

  // ---------- Estado ----------
  let st = Calc.fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) st = Object.assign(st, JSON.parse(raw)); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  // ---------- Vista ----------
  const $ = (id) => document.getElementById(id);
  const tapeEl = $("tape"), curEl = $("cur"), prevEl = $("prev");

  function dayLabel(t) {
    const d = new Date(t), now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Hoy";
    if (d.toDateString() === y.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "short" });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function renderTape() {
    if (!st.hist.length) {
      tapeEl.innerHTML = '<div class="tape-empty">Acá van quedando las cuentas, aunque cierres la app. Tocá un renglón para reusarlo o ponerle una nota.</div>';
      return;
    }
    let html = "", last = "";
    for (const e of st.hist) {
      const dl = dayLabel(e.t);
      if (dl !== last) { html += `<div class="day">${esc(dl)}</div>`; last = dl; }
      const tag = [e.note ? `<b>${esc(e.note)}</b>` : "", e.tag ? esc(e.tag) : ""].filter(Boolean).join("<br>");
      html += `<button class="row" data-id="${e.id}"><span class="tag">${tag}</span><span class="nums"><span class="ex">${esc(e.ex)}</span><br><span class="res${isNeg(e.res) ? " neg" : ""}">= ${esc(show(e.res))}</span></span></button>`;
    }
    tapeEl.innerHTML = html;
    tapeEl.scrollTop = tapeEl.scrollHeight;
  }
  function renderDisplay() {
    const txt = st.expr === "" ? "0" : (st.just ? show(st.expr) : Calc.pretty(st.expr));
    curEl.textContent = txt;
    const len = txt.length;
    curEl.style.fontSize = len > 22 ? "20px" : len > 16 ? "24px" : len > 12 ? "28px" : "";
    prevEl.textContent = Calc.preview(st);
  }
  function update(tapeToo = true) { if (tapeToo) renderTape(); renderDisplay(); save(); }

  let toastT;
  function flash(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1600);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); flash("Copiado"); }
    catch (e) { flash(text); }
  }

  // ---------- Hojas ----------
  const overlay = $("overlay");
  function openSheet(html, bind) {
    overlay.innerHTML = `<div class="shade"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    overlay.hidden = false;
    const shade = overlay.querySelector(".shade");
    shade.addEventListener("click", (ev) => { if (ev.target === shade) closeSheet(); });
    bind(overlay.querySelector(".sheet"));
  }
  function closeSheet() { overlay.hidden = true; overlay.innerHTML = ""; }

  function rowSheet(id) {
    const e = st.hist.find((x) => x.id === id); if (!e) return;
    const when = new Date(e.t).toLocaleString("es-UY", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    openSheet(`
      <h2>${esc(when)}</h2>
      <div class="big"><div class="ex">${esc(e.tag ? e.tag + "  ·  " : "")}${esc(e.ex)}</div><div class="res${isNeg(e.res) ? " neg" : ""}">= ${esc(show(e.res))}</div></div>
      <label class="field" for="note-in">Nota (ej. "dólar hoy", "sueldo por hora")
        <input id="note-in" type="text" maxlength="40" value="${esc(e.note)}" autocomplete="off"></label>
      <div class="btns">
        <button class="sb main" data-a="res">Usar resultado</button>
        <button class="sb" data-a="ex">Usar cálculo</button>
        <button class="sb" data-a="copy">Copiar resultado</button>
        <button class="sb warn" data-a="del">Borrar renglón</button>
      </div>`, (sh) => {
      const inp = sh.querySelector("#note-in");
      const keepNote = () => { const v = inp.value.trim(); if (v !== e.note) { e.note = v; update(); } };
      inp.addEventListener("change", keepNote);
      inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { keepNote(); closeSheet(); } });
      sh.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => {
        keepNote();
        const a = b.dataset.a;
        if (a === "res") { Calc.insertNumber(st, e.res); closeSheet(); update(false); }
        else if (a === "ex") { Calc.useExpr(st, e.ex); closeSheet(); update(false); }
        else if (a === "copy") copy(e.res);
        else if (a === "del") {
          if (b.dataset.sure) { st.hist = st.hist.filter((x) => x.id !== id); closeSheet(); update(); }
          else { b.dataset.sure = "1"; b.textContent = "Tocá de nuevo para borrar"; }
        }
      }));
    });
  }

  function usdSheet() {
    const v = Calc.currentValue(st);
    const when = st.rateAt ? new Date(st.rateAt).toLocaleDateString("es-UY", { day: "numeric", month: "short" }) : "";
    openSheet(`
      <h2>Pesos y dólares</h2>
      <label class="field" for="rate-in">Cotización del dólar (pesos por 1 US$)${when ? " · cargada el " + esc(when) : ""}
        <input id="rate-in" type="text" inputmode="decimal" placeholder="ej. 40.25" value="${esc(st.rate)}" autocomplete="off"></label>
      <p class="hint">${v === null ? "Escribí primero un monto en la calculadora." : "Monto actual: <b>" + esc(show(fmt(v))) + "</b>"}</p>
      <div class="btns">
        <button class="sb main" data-c="toUsd">$U → US$</button>
        <button class="sb main" data-c="toUyu">US$ → $U</button>
      </div>`, (sh) => {
      const inp = sh.querySelector("#rate-in");
      const readRate = () => {
        const r = Calc.readRate(inp.value);
        if (r !== null) { Calc.setRate(st, r); save(); }
        return r;
      };
      inp.addEventListener("change", readRate);
      sh.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => {
        const r = readRate();
        if (r === null) return flash("Poné la cotización");
        const msg = Calc.convert(st, r, b.dataset.c === "toUsd");
        if (msg) return flash(msg);
        closeSheet(); update();
      }));
    });
  }

  // ---------- Eventos ----------
  function press(k) {
    const msg = Calc.press(st, k);
    if (msg) flash(msg);
    update(k === "=" || k === "%");
  }
  $("keys").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-k]"); if (!b) return;
    press(b.dataset.k);
  });
  $("t-clear").addEventListener("click", () => { Calc.clear(st); update(false); });
  $("t-back").addEventListener("click", () => { Calc.back(st); update(false); });
  $("t-copy").addEventListener("click", () => { const v = Calc.currentValue(st); if (v !== null) copy(fmt(v)); });
  $("t-usd").addEventListener("click", usdSheet);
  tapeEl.addEventListener("click", (ev) => { const r = ev.target.closest(".row"); if (r) rowSheet(Number(r.dataset.id)); });

  // Teclado físico (por si se usa en la compu)
  document.addEventListener("keydown", (ev) => {
    if (!overlay.hidden) { if (ev.key === "Escape") closeSheet(); return; }
    const map = { "*": "×", "x": "×", "/": "÷", "Enter": "=", ",": "." };
    let k = map[ev.key] || ev.key;
    if (/^[0-9.+\-×÷()%=]$/.test(k)) { ev.preventDefault(); press(k); }
    else if (k === "Backspace") { $("t-back").click(); }
    else if (k === "Escape" || k === "Delete") { $("t-clear").click(); }
  });

  update();
})();
