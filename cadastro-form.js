// Agendamento em 7 etapas (2026-11-25): nome, contato, aniversário (o mesmo
// cadastro do Cash Barber), unidade e serviço, barbeiro, dia e hora livres, e
// confirmação. Os horários vêm do Venda Perfeita (/api/agenda), que já sabe o
// que está ocupado no Cash Barber. No fim abre o WhatsApp da Gran com tudo
// escrito e guarda o lead no VP (/api/cadastro). Quem marca no Cash Barber é a
// recepção.
(function () {
  var form = document.getElementById("signup");
  if (!form) return;

  var WHATSAPP = "5541988697721";
  var TOTAL = 7;
  var DAYS_AHEAD = 30;
  var step = 1;
  var sending = false;
  var steps = form.querySelectorAll(".step");
  var backBtn = document.getElementById("back");
  var nextBtn = document.getElementById("next");
  var nextLabel = document.getElementById("next-label");
  var geral = document.getElementById("e-geral");
  var stepN = document.getElementById("step-n");
  var bar = document.getElementById("bar");
  var barWrap = bar.parentNode;
  var dots = document.querySelectorAll("[data-dot]");
  var svcBox = document.getElementById("f-servico");
  var unitBox = document.getElementById("f-unidade");
  var svcHint = document.getElementById("svc-hint");
  var svcLoading = document.getElementById("svc-loading");
  var barberBox = document.getElementById("f-barbeiro");
  var dayBox = document.getElementById("f-dia");
  var timeBox = document.getElementById("f-hora");
  var timeMsg = document.getElementById("time-msg");
  var resumo = document.getElementById("resumo");

  // Escolhas do agendamento.
  var catalog = null; // { servicos, profissionais }
  var catalogError = "";
  var catalogLoading = false;
  var pick = { unidade: "", servico: null, barbeiro: "", dia: "", hora: "" };
  var daysFor = ""; // chave serviço|barbeiro dos dias carregados
  var timesFor = ""; // chave serviço|barbeiro|dia dos horários carregados
  var loadSeq = 0;

  // Origem da visita (utm do link).
  var params = new URLSearchParams(location.search);
  var origem = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    referrer: document.referrer || null,
  };

  function digits(v) { return String(v || "").replace(/\D/g, ""); }

  function maskPhone(v) {
    var d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function maskDate(v) {
    var d = digits(v).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
    return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  }

  function validDate(v) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return false;
    var day = +m[1], month = +m[2], year = +m[3];
    var dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return false;
    return year >= 1910 && dt.getTime() <= Date.now();
  }

  var brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function priceOf(s) {
    if (s.preco === null || s.preco === undefined) return "";
    return (s.precoAPartirDe ? "a partir de " : "") + brl.format(s.preco);
  }
  function durationOf(min) {
    if (!min) return "";
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + " min";
  }
  // "AAAA-MM-DD" lido ao meio-dia UTC: o dia certo em qualquer fuso.
  function dayParts(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return {
      week: d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", ""),
      num: d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "UTC" }),
      month: d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", ""),
      long: d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" }),
    };
  }
  function upperFirst(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function todayIso() {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return p;
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  var phone = form.elements.telefone;
  var birth = form.elements.nascimento;
  phone.addEventListener("input", function () { phone.value = maskPhone(phone.value); });
  birth.addEventListener("input", function () { birth.value = maskDate(birth.value); });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function option(name, value, checked, label) {
    var wrap = el("label", "tile");
    var input = el("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.checked = checked;
    wrap.appendChild(input);
    wrap.appendChild(label);
    return wrap;
  }

  function api(qs) {
    return fetch("/api/agenda?" + new URLSearchParams(qs))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok && d.ok, d: d }; }); })
      .catch(function () { return { ok: false, d: { error: "Sem conexão. Confira a internet e tente de novo." } }; });
  }

  // ---------- serviço ----------
  function loadCatalog() {
    if (catalogLoading || catalog) return;
    catalogLoading = true;
    svcLoading.hidden = false;
    svcLoading.textContent = "Carregando os serviços...";
    api({ op: "catalogo" }).then(function (res) {
      catalogLoading = false;
      if (!res.ok || !res.d.data || !res.d.data.servicos || !res.d.data.servicos.length) {
        catalogError = (res.d && res.d.error) || "Não deu pra carregar os serviços agora.";
        svcLoading.textContent = catalogError + " Fale com a gente pelo WhatsApp.";
        return;
      }
      catalog = res.d.data;
      catalogError = "";
      svcLoading.hidden = true;
      // Uma unidade só: já vale ela.
      if (units().length === 1) pick.unidade = units()[0];
      renderUnits();
      renderServices();
    });
  }

  // ---------- unidade ----------
  // O VP manda `unidades` quando a empresa tem mais de um endereço (Gran:
  // Batel e Cabral) e a `unidade` de cada barbeiro.
  function units() { return (catalog && catalog.unidades) || []; }
  function hasUnits() { return units().length > 1; }
  function renderUnits() {
    unitBox.hidden = !hasUnits();
    if (!hasUnits()) return;
    svcHint.textContent = "Escolha a unidade e o serviço. O tempo e o valor aparecem do lado.";
    unitBox.replaceChildren();
    units().forEach(function (u) {
      unitBox.appendChild(option("unidade", u, pick.unidade === u, el("span", "", u)));
    });
  }
  unitBox.addEventListener("change", function (e) {
    var v = e.target ? e.target.value : "";
    if (v === pick.unidade) return;
    pick.unidade = v;
    // Barbeiro e horário da outra unidade não valem aqui.
    pick.barbeiro = "";
    pick.dia = "";
    pick.hora = "";
    if (pick.servico && !barbersFor(pick.servico).length) pick.servico = null;
    setErr("unidade", "");
    setErr("servico", "");
    renderServices();
  });

  function servicesShown() {
    // Com mais de uma unidade, a lista só aparece depois dela (muda de uma pra outra).
    if (hasUnits() && !pick.unidade) return [];
    if (!pick.unidade) return catalog.servicos;
    return catalog.servicos.filter(function (s) { return barbersFor(s).length > 0; });
  }

  function renderServices() {
    svcBox.replaceChildren();
    servicesShown().forEach(function (s) {
      var label = el("span");
      var main = el("strong", "svc__name", s.nome);
      var meta = el("small", "svc__meta");
      var dur = durationOf(s.duracaoMin);
      var price = priceOf(s);
      if (dur) meta.appendChild(el("em", "", dur));
      if (price) meta.appendChild(el("b", "", price));
      label.appendChild(main);
      label.appendChild(meta);
      var opt = option("servico", s.id, !!(pick.servico && pick.servico.id === s.id), label);
      opt.className = "tile svc__item";
      svcBox.appendChild(opt);
    });
  }

  svcBox.addEventListener("change", function (e) {
    var id = e.target && e.target.value;
    var s = catalog && catalog.servicos.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (!pick.servico || pick.servico.id !== s.id) {
      pick.servico = s;
      // Serviço novo: barbeiro e horário escolhidos antes podem não valer mais.
      if (pick.barbeiro && s.profissionais.indexOf(pick.barbeiro) === -1) pick.barbeiro = "";
      pick.dia = "";
      pick.hora = "";
    }
    setErr("servico", "");
  });

  // ---------- barbeiro ----------
  function barbersFor(s) {
    if (!catalog || !s) return [];
    return catalog.profissionais.filter(function (p) {
      if (s.profissionais.indexOf(p.id) === -1) return false;
      // Barbeiro sem unidade no VP aparece nas duas.
      return !pick.unidade || !p.unidade || p.unidade === pick.unidade;
    });
  }
  function hasBarberStep() {
    return !!(catalog && catalog.escolheProfissional && barbersFor(pick.servico).length > 1);
  }
  function renderBarbers() {
    barberBox.replaceChildren();
    barberBox.appendChild(option("barbeiro", "", pick.barbeiro === "", el("span", "", "Sem preferência")));
    barbersFor(pick.servico).forEach(function (p) {
      barberBox.appendChild(option("barbeiro", p.id, pick.barbeiro === p.id, el("span", "", p.nome)));
    });
  }
  barberBox.addEventListener("change", function (e) {
    var v = e.target ? e.target.value : "";
    if (v !== pick.barbeiro) {
      pick.barbeiro = v;
      pick.dia = "";
      pick.hora = "";
    }
  });
  function barberName() {
    if (!pick.barbeiro) return "Sem preferência";
    var p = catalog.profissionais.filter(function (x) { return x.id === pick.barbeiro; })[0];
    return p ? p.nome : "Sem preferência";
  }

  // ---------- dia e hora ----------
  function baseQuery() {
    var q = { servico: pick.servico.id };
    if (pick.barbeiro) q.profissional = pick.barbeiro;
    return q;
  }

  // "Sem preferência" dentro de uma unidade: pergunta por barbeiro daquela
  // unidade e junta, porque o VP sem barbeiro escolhido olha todo mundo.
  function fetchSlots(q) {
    var ids = !pick.barbeiro && hasUnits() ? barbersFor(pick.servico).map(function (p) { return p.id; }) : [];
    if (!ids.length) return api(q);
    return Promise.all(ids.map(function (id) {
      var one = Object.assign({}, q, { profissional: id });
      return api(one);
    })).then(function (all) {
      var good = all.filter(function (r) { return r.ok && r.d.data; });
      if (!good.length) return all[0];
      if (q.op === "dias") {
        var byDay = {};
        good.forEach(function (r) {
          (r.d.data.dias || []).forEach(function (d) { byDay[d.data] = (byDay[d.data] || 0) + (d.vagas || 0); });
        });
        var dias = Object.keys(byDay).sort().map(function (k) { return { data: k, vagas: byDay[k] }; });
        return { ok: true, d: { data: { dias: dias } } };
      }
      var seen = {};
      good.forEach(function (r) { (r.d.data.horarios || []).forEach(function (h) { seen[h.hora] = h; }); });
      var horarios = Object.keys(seen).sort().map(function (k) { return seen[k]; });
      return { ok: true, d: { data: { horarios: horarios } } };
    });
  }

  function loadDays() {
    var key = pick.unidade + "|" + pick.servico.id + "|" + pick.barbeiro;
    if (key === daysFor && dayBox.children.length) return;
    daysFor = key;
    timesFor = "";
    var seq = ++loadSeq;
    dayBox.replaceChildren();
    timeBox.replaceChildren();
    timeMsg.textContent = "Procurando horários livres...";
    var today = todayIso();
    var q = baseQuery();
    q.op = "dias";
    q.de = today;
    q.ate = addDays(today, DAYS_AHEAD - 1);
    fetchSlots(q).then(function (res) {
      if (seq !== loadSeq) return;
      if (!res.ok) {
        daysFor = "";
        timeMsg.textContent = (res.d && res.d.error) || "Não deu pra carregar os horários agora.";
        return;
      }
      var open = (res.d.data.dias || []).filter(function (d) { return d.vagas > 0; });
      if (!open.length) {
        timeMsg.textContent = "Sem horário livre nos próximos dias com essa escolha. Tente sem preferência de barbeiro ou chame no WhatsApp.";
        return;
      }
      if (!pick.dia || !open.some(function (d) { return d.data === pick.dia; })) pick.dia = open[0].data;
      open.forEach(function (d) {
        var parts = dayParts(d.data);
        var label = el("span");
        label.appendChild(el("small", "", parts.week));
        label.appendChild(el("b", "", parts.num));
        label.appendChild(el("small", "", parts.month));
        var opt = option("dia", d.data, d.data === pick.dia, label);
        opt.className = "tile day";
        opt.querySelector("input").setAttribute("aria-label", parts.long + ", " + d.vagas + (d.vagas === 1 ? " horário" : " horários"));
        dayBox.appendChild(opt);
      });
      loadTimes();
    });
  }

  function loadTimes() {
    var key = pick.unidade + "|" + pick.servico.id + "|" + pick.barbeiro + "|" + pick.dia;
    if (key === timesFor) return;
    timesFor = key;
    var seq = ++loadSeq;
    timeBox.replaceChildren();
    timeMsg.textContent = "Carregando os horários...";
    var q = baseQuery();
    q.op = "horarios";
    q.data = pick.dia;
    fetchSlots(q).then(function (res) {
      if (seq !== loadSeq) return;
      if (!res.ok) {
        timesFor = "";
        timeMsg.textContent = (res.d && res.d.error) || "Não deu pra carregar os horários agora.";
        return;
      }
      var list = res.d.data.horarios || [];
      if (!list.length) {
        timeMsg.textContent = "Esse dia acabou de lotar. Escolha outro.";
        return;
      }
      timeMsg.textContent = "";
      if (!list.some(function (h) { return h.hora === pick.hora; })) pick.hora = "";
      list.forEach(function (h) {
        var opt = option("hora", h.hora, h.hora === pick.hora, el("span", "", h.hora));
        opt.className = "tile time";
        timeBox.appendChild(opt);
      });
    });
  }

  dayBox.addEventListener("change", function (e) {
    if (!e.target || e.target.value === pick.dia) return;
    pick.dia = e.target.value;
    pick.hora = "";
    setErr("hora", "");
    loadTimes();
  });
  timeBox.addEventListener("change", function (e) {
    if (e.target) pick.hora = e.target.value;
    setErr("hora", "");
  });

  // ---------- resumo e mensagem ----------
  function firstName() { return form.elements.nome.value.trim().split(/\s+/)[0]; }

  function summaryRows() {
    var s = pick.servico;
    var extra = [durationOf(s.duracaoMin), priceOf(s)].filter(Boolean).join(", ");
    var rows = [
      ["Nome", form.elements.nome.value.trim()],
      ["WhatsApp", phone.value],
      ["E-mail", form.elements.email.value.trim()],
      ["Aniversário", birth.value],
    ];
    if (hasUnits()) rows.push(["Unidade", pick.unidade]);
    return rows.concat([
      ["Serviço", s.nome + (extra ? " (" + extra + ")" : "")],
      ["Barbeiro", barberName()],
      ["Dia", upperFirst(dayParts(pick.dia).long)],
      ["Horário", pick.hora],
    ]);
  }

  function renderSummary() {
    resumo.replaceChildren();
    summaryRows().forEach(function (row) {
      var line = el("div");
      line.appendChild(el("dt", "", row[0]));
      line.appendChild(el("dd", "", row[1]));
      resumo.appendChild(line);
    });
  }

  function waUrl() {
    var lines = ["Olá! Quero agendar um horário na Gran Cavalheiro.", ""];
    summaryRows().forEach(function (row) { lines.push(row[0] + ": " + row[1]); });
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  // ---------- etapas ----------
  function setErr(name, msg) {
    var e = document.getElementById("e-" + name);
    if (e) e.textContent = msg || "";
    var input = form.elements[name];
    if (input && input.setAttribute) {
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  var FIELDS = { 1: ["nome"], 2: ["telefone", "email"], 3: ["nascimento"], 4: ["unidade", "servico"], 5: [], 6: ["hora"], 7: [] };
  var RULES = {
    nome: function () { return form.elements.nome.value.trim().split(/\s+/).filter(Boolean).length < 2 ? "Escreva nome e sobrenome." : ""; },
    telefone: function () { var t = digits(phone.value); return t.length < 10 || t.length > 11 ? "Use DDD + número." : ""; },
    email: function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.email.value.trim()) ? "" : "Confira o e-mail."; },
    nascimento: function () { return validDate(birth.value) ? "" : "Use dd/mm/aaaa."; },
    unidade: function () { return hasUnits() && !pick.unidade ? "Escolha a unidade." : ""; },
    servico: function () {
      if (!catalog) return catalogError ? "" : "Espere os serviços carregarem.";
      if (hasUnits() && !pick.unidade) return "";
      return pick.servico ? "" : "Escolha um serviço.";
    },
    hora: function () { return pick.dia && pick.hora ? "" : "Escolha o dia e o horário."; },
  };

  function stepOf(name) {
    for (var s = 1; s <= TOTAL; s++) if (FIELDS[s].indexOf(name) !== -1) return s;
    return 0;
  }

  function focusField(name) {
    var target = name === "unidade" ? unitBox.querySelector("input:checked, input") || svcBox.querySelector("input:checked, input") :
      name === "servico" ? svcBox.querySelector("input:checked, input") :
      name === "hora" ? timeBox.querySelector("input:checked, input") || dayBox.querySelector("input:checked") :
      name ? form.elements[name] : null;
    if (!target && step === 5) target = barberBox.querySelector("input:checked");
    if (target && target.focus) target.focus({ preventScroll: true });
  }

  function checkStep(s) {
    var firstBad = "";
    FIELDS[s].forEach(function (name) {
      var msg = RULES[name]();
      setErr(name, msg);
      if (msg && !firstBad) firstBad = name;
    });
    return firstBad;
  }

  function phase(s) { return s <= 3 ? 1 : s <= 5 ? 2 : s === 6 ? 3 : 4; }

  function render(dir) {
    form.setAttribute("data-dir", dir || "next");
    for (var i = 0; i < steps.length; i++) {
      var on = +steps[i].getAttribute("data-step") === step;
      steps[i].hidden = !on;
      steps[i].classList.remove("is-in");
      if (on) { void steps[i].offsetWidth; steps[i].classList.add("is-in"); }
    }
    backBtn.hidden = step === 1;
    if (step === TOTAL) {
      // No celular cabe só "Confirmar": o resto some pelo CSS.
      nextLabel.replaceChildren(document.createTextNode("Confirmar"), el("span", "cad__more", " no WhatsApp"));
    } else {
      nextLabel.textContent = "Continuar";
    }
    var ph = phase(step);
    stepN.textContent = ph;
    document.getElementById("step-name").textContent = ["Você", "Serviço", "Horário", "Confirmar"][ph - 1];
    bar.style.width = (step / TOTAL) * 100 + "%";
    barWrap.setAttribute("aria-valuenow", ph);
    for (var d = 0; d < dots.length; d++) {
      var n = +dots[d].getAttribute("data-dot");
      dots[d].classList.toggle("is-done", n < ph);
      dots[d].classList.toggle("is-current", n === ph);
    }
  }

  function enter(s) {
    if (s === 4) loadCatalog();
    if (s === 5) renderBarbers();
    if (s === 6) loadDays();
    if (s === 7) renderSummary();
  }

  function go(to, dir, focusName) {
    step = to;
    geral.textContent = "";
    render(dir);
    enter(step);
    // No celular o formulário fica abaixo da foto: traz a pergunta pra vista.
    var top = form.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + top - 90, behavior: "smooth" });
    }
    focusField(focusName || FIELDS[step][0]);
  }

  function nextFrom(s) { return s === 4 && !hasBarberStep() ? 6 : s + 1; }
  function prevFrom(s) { return s === 6 && !hasBarberStep() ? 4 : s - 1; }

  // Erro some assim que a pessoa corrige o campo.
  form.addEventListener("input", function (e) {
    var name = e.target && e.target.name;
    var msgEl = name && document.getElementById("e-" + name);
    if (msgEl && msgEl.textContent) setErr(name, "");
  });

  backBtn.addEventListener("click", function () {
    if (step > 1 && !sending) go(prevFrom(step), "back");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    geral.textContent = "";
    var bad = checkStep(step);
    if (bad) { focusField(bad); return; }
    if (step < TOTAL) {
      if (step === 4 && !catalog) { geral.textContent = catalogError || "Espere os serviços carregarem."; return; }
      go(nextFrom(step), "next");
      return;
    }
    confirmBooking();
  });

  function confirmBooking() {
    var url = waUrl();
    // Abre o WhatsApp no mesmo clique (fora dele o navegador bloqueia a janela).
    var win = window.open(url, "_blank");
    if (win) { try { win.opener = null; } catch (err) { /* outra origem */ } }
    document.getElementById("done-wa").href = url;
    saveLead();
    if (typeof window.fbq === "function") window.fbq("track", "Lead");
    done();
    if (!win) window.location.href = url;
  }

  // Guarda o pedido no VP (interno). Não segura o cliente: falhou, o WhatsApp já abriu.
  function saveLead() {
    var respostas = summaryRows().slice(4).map(function (row) { return { pergunta: row[0], resposta: row[1] }; });
    try {
      fetch("/api/cadastro", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: form.elements.nome.value.trim(),
          email: form.elements.email.value.trim(),
          telefone: phone.value,
          nascimento: birth.value,
          comoConheceu: "Site",
          respostas: respostas,
          empresa: form.elements.empresa.value,
          origem: origem,
        }),
      }).catch(function () {});
    } catch (err) {
      // Sem fetch com keepalive: o pedido segue pelo WhatsApp mesmo assim.
    }
  }

  function done() {
    document.getElementById("done-nome").textContent = firstName();
    form.hidden = true;
    document.getElementById("alt").hidden = true;
    document.getElementById("progress").hidden = true;
    for (var d = 0; d < dots.length; d++) { dots[d].classList.add("is-done"); dots[d].classList.remove("is-current"); }
    var box = document.getElementById("signup-done");
    box.hidden = false;
    box.querySelector("h1").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  render("next");
  steps[0].classList.remove("is-in");
  // Os serviços já vêm carregando enquanto a pessoa preenche os dados.
  loadCatalog();
})();
