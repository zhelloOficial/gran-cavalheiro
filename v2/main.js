/* Gran Cavalheiro, versão 2 */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const boot = () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const video = $(".intro__video");
  video.src = window.innerWidth <= 760 ? video.dataset.srcMobile : video.dataset.srcDesktop;
  video.play().catch(() => {});

  /* ---------- abertura: GRAN vazado com o vídeo dentro ---------- */
  const sticky = $(".intro__sticky");
  const word = $(".intro__word");
  const w1 = $("#w1");
  const w2 = $("#w2");
  const CAP = 0.69; // altura da maiúscula da Archivo, em relação ao corpo
  let introTl;

  function buildIntro() {
    if (introTl) { introTl.scrollTrigger.kill(); introTl.kill(); }
    gsap.set(word, { clearProps: "all" });
    word.removeAttribute("transform");

    const W = sticky.clientWidth;
    const H = sticky.clientHeight;
    const small = W <= 760;

    // mede a largura de cada palavra por unidade de corpo
    w1.style.fontSize = "100px";
    w2.style.fontSize = "100px";
    const r1 = w1.getComputedTextLength() / 100;
    const r2 = w2.getComputedTextLength() / 100;

    // as duas linhas fecham na mesma largura, como no logo
    let width = W * (small ? 0.9 : 0.78);
    const height = (w) => CAP * (w / r1) + 0.09 * (w / r1) + CAP * (w / r2);
    const maxH = H * (small ? 0.5 : 0.6);
    if (height(width) > maxH) width *= maxH / height(width);

    const fs1 = width / r1;
    const fs2 = width / r2;
    const top = (H - height(width)) / 2 - (small ? H * 0.04 : 0);
    const base1 = top + CAP * fs1;
    const base2 = base1 + 0.09 * fs1 + CAP * fs2;

    w1.style.fontSize = `${fs1}px`;
    w2.style.fontSize = `${fs2}px`;
    gsap.set(w1, { attr: { x: W / 2, y: base1 } });
    gsap.set(w2, { attr: { x: W / 2, y: base2 } });

    // o mergulho acontece pela haste do R
    const r = w1.getExtentOfChar(1);
    const ox = r.x + r.width * 0.2;
    const oy = base1 - CAP * fs1 * 0.5;

    introTl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: ".intro", start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
    })
      .to([".intro__sub", ".intro__tag"], { autoAlpha: 0, duration: 0.1 }, 0)
      .to(word, { scale: 60, svgOrigin: `${ox} ${oy}`, ease: "power3.in", duration: 0.66 }, 0)
      .fromTo(video, { scale: 1.12 }, { scale: 1, duration: 1 }, 0)
      .to(".intro__mask", { autoAlpha: 0, duration: 0.08 }, 0.6)
      .to(".intro__shade", { opacity: 1, duration: 0.2 }, 0.58)
      .fromTo(".intro__copy > *", { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.18, stagger: 0.05, ease: "power2.out" }, 0.66)
      .to(".nav__logo", { autoAlpha: 1, duration: 0.1 }, 0.66)
      .to({}, { duration: 0.06 });
  }

  buildIntro();
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    buildIntro();
    ScrollTrigger.refresh();
  });

  // entrada: o vídeo "revela" dentro das letras
  gsap.timeline({ defaults: { ease: "power2.out" } })
    .add(() => document.body.classList.remove("is-loading"))
    .fromTo(w1, { fill: "#fff" }, { fill: "#000", duration: 1.8, ease: "power2.inOut" }, 0.1)
    .fromTo(w2, { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0.9)
    .fromTo(".intro__tag", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.2 }, 1.1)
    .fromTo([".nav .btn", ".mbar"], { opacity: 0 }, { opacity: 1, duration: 1 }, 1.1);

  /* ---------- cenas: uma cobre a outra ---------- */
  const stack = $(".stack");
  const cards = $$(".card");
  cards.forEach((card, i) => {
    const h = () => card.offsetHeight;
    const arrive = { trigger: stack, start: () => `top+=${i * h()} bottom`, end: () => `top+=${i * h()} top`, scrub: true, invalidateOnRefresh: true };
    gsap.fromTo($("img", card), { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: arrive });
    gsap.from($(".card__word span", card), {
      yPercent: 110, duration: 1.2, ease: "expo.out",
      scrollTrigger: { trigger: stack, start: () => `top+=${i * h()} 40%`, invalidateOnRefresh: true },
    });
    if (i < cards.length - 1) {
      const leave = { trigger: stack, start: () => `top+=${(i + 1) * h()} bottom`, end: () => `top+=${(i + 1) * h()} top`, scrub: true, invalidateOnRefresh: true };
      gsap.to($(".card__inner", card), { scale: 0.92, ease: "none", scrollTrigger: leave });
      gsap.to($(".card__dim", card), { opacity: 0.75, ease: "none", scrollTrigger: leave });
    }
  });

  /* ---------- barra do topo ganha fundo depois da abertura ---------- */
  const nav = $(".nav");
  ScrollTrigger.create({
    trigger: ".stack", start: "top top+=80", end: "max",
    onToggle: (self) => nav.classList.toggle("is-solid", self.isActive),
  });

  /* ---------- blocos de informação ---------- */
  $$(".head").forEach((head) =>
    gsap.from(head.children, { y: 32, autoAlpha: 0, duration: 1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: head, start: "top 82%" } })
  );
  gsap.from(".feat", { y: 48, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: ".exp__grid", start: "top 82%" } });
  gsap.from(".svc", { y: 40, autoAlpha: 0, duration: 1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: ".svc__grid", start: "top 85%" } });
  gsap.from(".reviews__score > *", { y: 30, autoAlpha: 0, duration: 1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: ".reviews", start: "top 75%" } });
  gsap.from(".quote", { y: 40, autoAlpha: 0, duration: 1, stagger: 0.12, ease: "expo.out", scrollTrigger: { trigger: ".reviews__list", start: "top 82%" } });
  const score = $("[data-count]");
  const counter = { v: 0 };
  ScrollTrigger.create({
    trigger: score, start: "top 85%", once: true,
    onEnter: () => gsap.to(counter, { v: 5, duration: 1.6, ease: "power3.out", onUpdate: () => (score.textContent = counter.v.toFixed(1).replace(".", ",")) }),
  });

  /* ---------- clube ---------- */
  gsap.fromTo(".club__media", { clipPath: "inset(12% 10% 12% 10% round 12px)" }, {
    clipPath: "inset(0% 0% 0% 0% round 12px)", ease: "none",
    scrollTrigger: { trigger: ".club__media", start: "top 95%", end: "top 35%", scrub: true },
  });
  gsap.fromTo(".club__media img", { scale: 1.25 }, {
    scale: 1, ease: "none",
    scrollTrigger: { trigger: ".club", start: "top bottom", end: "bottom top", scrub: true },
  });
  gsap.from([".club .eyebrow", ".club__title", ".club__lead"], {
    y: 36, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: "expo.out",
    scrollTrigger: { trigger: ".club__body", start: "top 78%" },
  });
  gsap.from(".club__list li", {
    y: 20, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: "expo.out",
    scrollTrigger: { trigger: ".club__list", start: "top 85%" },
  });
  gsap.from(".club__cta", { y: 20, autoAlpha: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".club__cta", start: "top 94%" } });

  /* ---------- aberto agora ---------- */
  const HOURS = { 0: null, 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 18] };
  const DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const paintStatus = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    const now = (Number(get("hour")) % 24) + Number(get("minute")) / 60;
    const today = HOURS[day];
    const isOpen = Boolean(today && now >= today[0] && now < today[1]);
    let text;
    if (isOpen) text = `Aberto agora · até ${today[1]}h`;
    else if (today && now < today[0]) text = `Abre hoje às ${today[0]}h`;
    else {
      let next = (day + 1) % 7;
      while (!HOURS[next]) next = (next + 1) % 7;
      text = `Fechado · abre ${next === (day + 1) % 7 ? "amanhã" : DAYS[next]} às ${HOURS[next][0]}h`;
    }
    $$("[data-status]").forEach((el) => {
      el.classList.toggle("is-open", isOpen);
      el.classList.toggle("is-closed", !isOpen);
      $("b", el).textContent = text;
    });
  };
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------- unidades ---------- */
  gsap.from(".unit__body", { y: 60, autoAlpha: 0, duration: 1.2, stagger: 0.15, ease: "expo.out", scrollTrigger: { trigger: ".units", start: "top 60%" } });

  window.addEventListener("load", () => ScrollTrigger.refresh());
};

// espera a fonte pra medir as letras certo (no máximo 2,5 s)
let booted = false;
const start = () => { if (!booted) { booted = true; boot(); } };
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(start);
