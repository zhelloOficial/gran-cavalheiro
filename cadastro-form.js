// Formulário de cadastro: valida no navegador, manda pra /api/cadastro (que fala com o VP).
(function () {
  var form = document.getElementById("signup");
  if (!form) return;
  var submit = form.querySelector(".signup__submit");
  var label = form.querySelector(".signup__label");
  var geral = document.getElementById("e-geral");

  // Origem da visita (utm do link), guardada na primeira página aberta.
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

  function setErr(name, msg) {
    var el = document.getElementById("e-" + name);
    if (el) el.textContent = msg || "";
    var input = name === "comoConheceu" ? document.getElementById("f-como") : form.elements[name];
    if (input && input.setAttribute) {
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function chosen() {
    var c = form.querySelector('input[name="comoConheceu"]:checked');
    return c ? c.value : "";
  }

  function check() {
    var errs = {};
    var nome = form.elements.nome.value.trim();
    if (nome.split(/\s+/).filter(Boolean).length < 2) errs.nome = "Escreva nome e sobrenome.";
    var email = form.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errs.email = "Confira o e-mail.";
    var tel = digits(phone.value);
    if (tel.length < 10 || tel.length > 11) errs.telefone = "Use DDD + número.";
    if (!validDate(birth.value)) errs.nascimento = "Use dd/mm/aaaa.";
    if (!chosen()) errs.comoConheceu = "Escolha uma opção.";
    ["nome", "email", "telefone", "nascimento", "comoConheceu"].forEach(function (k) { setErr(k, errs[k]); });
    return errs;
  }

  // Erro some assim que a pessoa corrige o campo.
  form.addEventListener("input", function (e) {
    var name = e.target && e.target.name;
    if (name && document.getElementById("e-" + name) && document.getElementById("e-" + name).textContent) setErr(name, "");
  });
  form.addEventListener("change", function (e) {
    if (e.target && e.target.name === "comoConheceu") setErr("comoConheceu", "");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    geral.textContent = "";
    var errs = check();
    var first = Object.keys(errs)[0];
    if (first) {
      var el = first === "comoConheceu" ? form.querySelector('input[name="comoConheceu"]') : form.elements[first];
      if (el) el.focus();
      return;
    }

    submit.disabled = true;
    label.textContent = "Enviando...";
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
        if (res.ok) {
          document.getElementById("done-nome").textContent = form.elements.nome.value.trim().split(/\s+/)[0];
          document.getElementById("signup-form-wrap").hidden = true;
          var done = document.getElementById("signup-done");
          done.hidden = false;
          done.querySelector("h1").focus();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        var campo = res.d && res.d.campo;
        if (campo && document.getElementById("e-" + campo)) {
          setErr(campo, res.d.error);
          if (form.elements[campo]) form.elements[campo].focus();
        } else {
          geral.textContent = (res.d && res.d.error) || "Não deu pra concluir o cadastro agora. Tente de novo.";
        }
      })
      .catch(function () {
        geral.textContent = "Sem conexão. Confira a internet e tente de novo.";
      })
      .then(function () {
        submit.disabled = false;
        label.textContent = "Fazer cadastro";
      });
  });
})();
