// Motor de la calculadora: tokenizer, parser, redondeo, edición de la línea y
// el % estilo CalcMem. Sin DOM, sin localStorage y sin eval: lo usan la página
// (window.Calc) y los tests (require).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_HIST = 50;
  const OPS = "+-×÷";
  const DIV0 = "No se puede dividir por cero";
  const BAD = "Revisá el cálculo";

  // Estado vacío. La página lo mezcla con lo guardado en localStorage.
  const fresh = () => ({ hist: [], expr: "", just: false, rate: "", rateAt: 0, nid: 1 });

  // ---------- Matemática ----------
  function tokenize(s) {
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; const n = s.slice(i, j);
        if ((n.match(/\./g) || []).length > 1 || n === ".") throw 0; t.push(n); i = j; }
      else if (OPS.includes(c) || c === "(" || c === ")") { t.push(c); i++; }
      else throw 0;
    }
    return t;
  }
  function parse(tokens) {
    let p = 0;
    const peek = () => tokens[p];
    function expr() { let v = term(); while (peek() === "+" || peek() === "-") { const o = tokens[p++]; const r = term(); v = o === "+" ? v + r : v - r; } return v; }
    function term() { let v = factor(); while (peek() === "×" || peek() === "÷") { const o = tokens[p++]; const r = factor(); if (o === "÷" && r === 0) throw "div0"; v = o === "×" ? v * r : v / r; } return v; }
    function factor() {
      const t = tokens[p];
      if (t === "-") { p++; return -factor(); }
      if (t === "+") { p++; return factor(); }
      if (t === "(") { p++; const v = expr(); if (tokens[p] === ")") p++; return v; }
      if (t !== undefined && /^[0-9.]/.test(t)) { p++; return parseFloat(t); }
      throw 0;
    }
    const v = expr(); if (p !== tokens.length) throw 0; return v;
  }
  const calc = (s) => parse(tokenize(s));
  // Redondeo para que 153.63 - 108 dé 45.63 y no 45.6299999…
  function fmt(n) {
    if (!isFinite(n)) throw "inf";
    let r = Number(n.toPrecision(12)); if (Object.is(r, -0)) r = 0;
    let s = String(r);
    if (/e/.test(s)) s = r.toPrecision(10).replace(/\.?0+e/, "e");
    return s;
  }
  const isUnary = (tokens, i) => tokens[i] === "-" && (i === 0 || OPS.includes(tokens[i - 1]) || tokens[i - 1] === "(");
  function pretty(s) {
    let tk; try { tk = tokenize(s); } catch (e) { return s; }
    return tk.map((t, i) => {
      if (OPS.includes(t) && !(t === "-" && isUnary(tk, i)) && !(t === "+" && (i === 0 || tk[i-1] === "("))) return " " + (t === "-" ? "−" : t) + " ";
      return t === "-" ? "−" : t;
    }).join("");
  }
  const openParens = (s) => [...s].reduce((a, c) => a + (c === "(") - (c === ")"), 0);
  function closeAll(s) { let n = openParens(s); while (n-- > 0) s += ")"; return s; }
  // Lo que se calcularía al apretar = (sin operadores colgando, paréntesis cerrados)
  const ready = (s) => closeAll(s.replace(/[+\-×÷(]+$/, ""));
  const hasOp = (tk) => tk.some((t, i) => OPS.includes(t) && !isUnary(tk, i));

  // ---------- Entrada ----------
  // Cada tecla modifica st; si hay que avisar algo, devuelve el texto del aviso.
  function press(st, k) {
    if (/[0-9]/.test(k)) return digit(st, k);
    if (k === ".") return dot(st);
    if (OPS.includes(k)) return op(st, k);
    if (k === "(") return openP(st);
    if (k === ")") return closeP(st);
    if (k === "±") return sign(st);
    if (k === "%") return percent(st);
    if (k === "=") return equals(st);
  }
  const lastChar = (st) => st.expr.slice(-1);
  function startFresh(st) { if (st.just) { st.expr = ""; st.just = false; } }
  function digit(st, d) {
    startFresh(st);
    if (lastChar(st) === ")") st.expr += "×";
    if (st.expr.length > 60) return;
    const m = st.expr.match(/(^|[^0-9.])0$/); // evita "007"
    if (m) st.expr = st.expr.slice(0, -1);
    st.expr += d;
  }
  function dot(st) {
    startFresh(st);
    const m = st.expr.match(/[0-9.]*$/)[0];
    if (m.includes(".")) return;
    if (lastChar(st) === ")") st.expr += "×";
    st.expr += m === "" ? "0." : ".";
  }
  function op(st, o) {
    st.just = false;
    const c = lastChar(st);
    if (st.expr === "" ) { if (o === "-") st.expr = "-"; return; }
    if (c === "(") { if (o === "-") st.expr += "-"; return; }
    if (OPS.includes(c)) {
      const prev = st.expr.slice(-2, -1);
      if (o === "-" && (c === "×" || c === "÷")) { st.expr += "-"; return; }
      if (c === "-" && (prev === "×" || prev === "÷" || prev === "(" || prev === "")) { if (prev === "") return; st.expr = st.expr.slice(0, -2); }
      else st.expr = st.expr.slice(0, -1);
      if (st.expr === "") return;
    }
    if (st.expr.endsWith(".")) st.expr += "0";
    st.expr += o;
  }
  function openP(st) {
    startFresh(st);
    const c = lastChar(st);
    if (/[0-9.)]/.test(c)) st.expr += "×";
    st.expr += "(";
  }
  function closeP(st) {
    st.just = false;
    if (openParens(st.expr) > 0 && /[0-9.)]/.test(lastChar(st))) st.expr += ")";
  }
  function sign(st) {
    st.just = false;
    const m = st.expr.match(/[0-9.]+$/);
    if (!m) { if (st.expr === "") st.expr = "-"; else if (st.expr === "-") st.expr = ""; return; }
    const at = st.expr.length - m[0].length;
    const before = st.expr.slice(0, at);
    const b1 = before.slice(-1), b2 = before.slice(-2, -1);
    if (b1 === "-" && (b2 === "" || OPS.includes(b2) || b2 === "(")) st.expr = before.slice(0, -1) + m[0];
    else if (b1 === "+" && before.length > 1) st.expr = before.slice(0, -1) + "-" + m[0];
    else if (b1 === "-") st.expr = before.slice(0, -1) + "+" + m[0];
    else st.expr = before + "-" + m[0];
  }
  // Goma: borra el cálculo actual. Flecha: un carácter. Ninguna toca el historial.
  function clear(st) { st.expr = ""; st.just = false; }
  function back(st) { st.just = false; st.expr = st.expr.slice(0, -1); }

  function addHist(st, e) {
    e.id = st.nid++; e.t = Date.now(); e.note = e.note || "";
    st.hist.push(e);
    while (st.hist.length > MAX_HIST) st.hist.shift();
  }

  function equals(st) {
    if (st.just || st.expr === "") return;
    const s = ready(st.expr);
    let tk; try { tk = tokenize(s); } catch (e) { return BAD; }
    let v; try { v = fmt(calc(s)); } catch (e) { return e === "div0" ? DIV0 : BAD; }
    if (hasOp(tk)) addHist(st, { ex: pretty(s), res: v });
    st.expr = v; st.just = true;
  }

  // 56 + 23 %  →  56 + 12.88 = 68.88
  function percent(st) {
    if (st.expr === "") return;
    let tk; try { tk = tokenize(st.expr); } catch (e) { return; }
    if (!/^[0-9.]/.test(tk[tk.length - 1] || "")) return;
    let k = tk.length - 1, N = parseFloat(tk[k]);
    if (isUnary(tk, k - 1)) { N = -N; k--; }
    const o = tk[k - 1];
    const label = pretty(st.expr).replace(/ /g, "") + "%";
    let ex, res;
    try {
      if (o === undefined) { res = N / 100; ex = fmt(N) + " ÷ 100"; }
      else {
        const L = tk.slice(0, k - 1).join("");
        if (openParens(L) !== 0) throw 0;
        const base = calc(L);
        const Lp = (hasOp(tokenize(L)) && (o === "×" || o === "÷")) ? "(" + pretty(L) + ")" : pretty(L);
        if (o === "+" || o === "-") { const p = base * N / 100; res = o === "+" ? base + p : base - p; ex = Lp + (o === "+" ? " + " : " − ") + fmt(p); }
        else if (o === "×") { res = base * N / 100; ex = Lp + " × " + fmt(N / 100); }
        else { if (N === 0) throw "div0"; res = base / (N / 100); ex = Lp + " ÷ " + fmt(N / 100); }
      }
      res = fmt(res);
    } catch (e) { return e === "div0" ? DIV0 : "Cerrá los paréntesis antes del %"; }
    addHist(st, { ex, res, tag: label });
    st.expr = res; st.just = true;
  }

  // Valor de lo que hay en pantalla, o null si todavía no es un número.
  function currentValue(st) {
    if (st.expr === "") return null;
    try { return calc(ready(st.expr)); } catch (e) { return null; }
  }
  // Resultado parcial que se muestra chico debajo del display ("= 68.88").
  function preview(st) {
    if (st.just || !st.expr) return "";
    try {
      const s = ready(st.expr);
      if (hasOp(tokenize(s))) return "= " + show(fmt(calc(s)));
    } catch (e) {}
    return "";
  }

  // Mete un número en el cálculo actual (si venía de un "=", lo reemplaza)
  function insertNumber(st, n) {
    const s = String(n);
    if (st.just || st.expr === "") { st.expr = s; st.just = false; }
    else {
      const c = lastChar(st);
      if (/[0-9.)]/.test(c)) st.expr += "×";
      st.expr += s.startsWith("-") && !(OPS.includes(c) || c === "(") ? "(" + s + ")" : s;
    }
  }
  // "Usar cálculo" de un renglón: vuelve a poner su cuenta para editarla
  function useExpr(st, ex) { st.expr = ex.replace(/ /g, "").replace(/−/g, "-"); st.just = false; }

  // ---------- Dólar ----------
  // Cotización escrita a mano ("40,25" o "40.25"); null si no es un número positivo.
  function readRate(text) {
    const r = parseFloat(String(text).replace(",", "."));
    return r > 0 ? r : null;
  }
  function setRate(st, r) {
    if (String(r) !== st.rate) { st.rate = String(r); st.rateAt = Date.now(); }
  }
  // Plata: redondeada a centavos (31.0559… → 31.06)
  const cents = (n) => fmt(Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100);
  // Los dos resultados del monto en pantalla: { amount, usd, uyu }, o null si no hay monto.
  function conversions(st, r) {
    const v = currentValue(st);
    if (v === null || !(r > 0)) return null;
    return { amount: fmt(v), usd: cents(v / r), uyu: cents(v * r) };
  }
  // Convierte lo que hay en pantalla y lo deja en el historial.
  function convert(st, r, toUsd) {
    const v = currentValue(st);
    if (v === null) return "Primero escribí un monto";
    const res = cents(toUsd ? v / r : v * r);
    addHist(st, { ex: show(fmt(v)) + (toUsd ? " ÷ " : " × ") + r, res, tag: toUsd ? "$U → US$" : "US$ → $U" });
    st.expr = res; st.just = true;
  }

  const show = (r) => String(r).replace(/^-/, "−");
  const isNeg = (r) => String(r).startsWith("-");

  return {
    MAX_HIST, fresh, tokenize, parse, calc, fmt, pretty, isUnary, openParens, closeAll,
    press, clear, back, addHist, currentValue, preview, insertNumber, useExpr,
    readRate, setRate, conversions, convert, show, isNeg,
  };
});
