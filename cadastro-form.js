// Cadastro em 4 etapas: valida cada etapa no navegador e, na última, manda pra
// /api/cadastro (que fala com o VP). Uma pergunta por vez, Enter avança.
(function () {
  var form = document.getElementById("signup");
  if (!form) return;

  var TOTAL = 4;
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

  var phone = form.elements.telefone;
  var birth = form.elements.nascimento;
  phone.addEventListener("input", function () { phone.value = maskPhone(phone.value); });
  birth.addEventListener("input", function () { birth.value = maskDate(birth.value); });

  function chosen() {
    var c = form.querySelector('input[name="comoConheceu"]:checked');
    return c ? c.value : "";
  }

  function setErr(name, msg) {
    var el = document.getElementById("e-" + name);
    if (el) el.textContent = msg || "";
    var input = name === "comoConheceu" ? document.getElementById("f-como") : form.elements[name];
    if (input && input.setAttribute) {
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  // Campos de cada etapa e a regra de cada um.
  var FIELDS = { 1: ["nome"], 2: ["telefone", "email"], 3: ["nascimento"], 4: ["comoConheceu"] };
  var RULES = {
    nome: function () { return form.elements.nome.value.trim().split(/\s+/).filter(Boolean).length < 2 ? "Escreva nome e sobrenome." : ""; },
    telefone: function () { var t = digits(phone.value); return t.length < 10 || t.length > 11 ? "Use DDD + número." : ""; },
    email: function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.email.value.trim()) ? "" : "Confira o e-mail."; },
    nascimento: function () { return validDate(birth.value) ? "" : "Use dd/mm/aaaa."; },
    comoConheceu: function () { return chosen() ? "" : "Escolha uma opção."; },
  };

  function stepOf(name) {
    for (var s = 1; s <= TOTAL; s++) if (FIELDS[s].indexOf(name) !== -1) return s;
    return 0;
  }

  function focusField(name) {
    var el = name === "comoConheceu" ? form.querySelector('input[name="comoConheceu"]') : form.elements[name];
    if (el) el.focus({ preventScroll: true });
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

  function render(dir) {
    form.setAttribute("data-dir", dir || "next");
    for (var i = 0; i < steps.length; i++) {
      var on = +steps[i].getAttribute("data-step") === step;
      steps[i].hidden = !on;
      steps[i].classList.remove("is-in");
      if (on) { void steps[i].offsetWidth; steps[i].classList.add("is-in"); }
    }
    backBtn.hidden = step === 1;
    nextLabel.textContent = step === TOTAL ? "Concluir cadastro" : "Continuar";
    stepN.textContent = step;
    bar.style.width = (step / TOTAL) * 100 + "%";
    barWrap.setAttribute("aria-valuenow", step);
    for (var d = 0; d < dots.length; d++) {
      var n = +dots[d].getAttribute("data-dot");
      dots[d].classList.toggle("is-done", n < step);
      dots[d].classList.toggle("is-current", n === step);
    }
  }

  function go(to, dir, focusName) {
    step = to;
    geral.textContent = "";
    render(dir);
    // No celular o formulário fica abaixo da foto: traz a pergunta pra vista.
    var top = form.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + top - 90, behavior: "smooth" });
    }
    focusField(focusName || FIELDS[step][0]);
  }

  // Erro some assim que a pessoa corrige o campo.
  form.addEventListener("input", function (e) {
    var name = e.target && e.target.name;
    var el = name && document.getElementById("e-" + name);
    if (el && el.textContent) setErr(name, "");
  });
  form.addEventListener("change", function (e) {
    if (e.target && e.target.name === "comoConheceu") setErr("comoConheceu", "");
  });

  backBtn.addEventListener("click", function () {
    if (step > 1 && !sending) go(step - 1, "back");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    geral.textContent = "";
    var bad = checkStep(step);
    if (bad) { focusField(bad); return; }
    if (step < TOTAL) { go(step + 1, "next"); return; }
    send();
  });

  function send() {
    sending = true;
    nextBtn.disabled = true;
    nextLabel.textContent = "Enviando...";
    fetch("/api/cadastro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: form.elements.nome.value.trim(),
        email: form.elements.email.value.trim(),
        telefone: phone.value,
        nascimento: birth.value,
        comoConheceu: chosen(),
        empresa: form.elements.empresa.value,
        origem: origem,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok && d.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { done(); return; }
        var campo = res.d && res.d.campo;
        var s = campo ? stepOf(campo) : 0;
        if (s) {
          go(s, s < step ? "back" : "next", campo);
          setErr(campo, res.d.error);
        } else {
          geral.textContent = (res.d && res.d.error) || "Não deu pra concluir o cadastro agora. Tente de novo.";
        }
      })
      .catch(function () {
        geral.textContent = "Sem conexão. Confira a internet e tente de novo.";
      })
      .then(function () {
        sending = false;
        nextBtn.disabled = false;
        nextLabel.textContent = step === TOTAL ? "Concluir cadastro" : "Continuar";
      });
  }

  function done() {
    document.getElementById("done-nome").textContent = form.elements.nome.value.trim().split(/\s+/)[0];
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
})();
