/* Gran Cavalheiro, animações da versão enxuta */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const boot = () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const isMobile = window.innerWidth <= 640;

  gsap.registerPlugin(ScrollTrigger, SplitText);

  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // vídeo do topo (versão leve no celular)
  const video = $(".hero__video");
  video.src = isMobile ? video.dataset.srcMobile : video.dataset.srcDesktop;
  video.play().catch(() => {});

  // entrada do topo
  const split = new SplitText(".hero__title", { type: "lines,words", mask: "lines" });
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .set([".hero__title", ".hero__row", ".nav"], { visibility: "visible" })
    .fromTo(".hero__video", { scale: 1.2 }, { scale: 1, duration: 2.4 })
    .from(split.words, { yPercent: 110, duration: 1.2, stagger: 0.05 }, 0.1)
    .from(".hero__row", { y: 24, autoAlpha: 0, duration: 1 }, 0.6)
    .from(".nav", { y: -20, autoAlpha: 0, duration: 1 }, 0.6)
    .add(() => document.body.classList.remove("is-loading"), 0);

  // vídeo afunda devagar ao rolar
  gsap.to(".hero__video", { yPercent: 15, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  // menu e barra do celular
  const nav = $(".nav");
  const mbar = $(".mbar");
  lenis.on("scroll", ({ scroll }) => {
    nav.classList.toggle("is-solid", scroll > 40);
    mbar.classList.toggle("is-on", scroll > window.innerHeight * 0.7);
  });

  // cenas: a foto abre de dentro pra fora e a palavra sobe
  $$(".scene").forEach((scene) => {
    const img = $("img", scene);
    const cap = $("figcaption", scene);
    gsap.fromTo(scene, { clipPath: "inset(14% 10% 14% 10% round 12px)" }, {
      clipPath: "inset(0% 0% 0% 0% round 12px)", ease: "none",
      scrollTrigger: { trigger: scene, start: "top bottom", end: "top 20%", scrub: true },
    });
    gsap.fromTo(img, { scale: 1.3 }, {
      scale: 1, ease: "none",
      scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true },
    });
    gsap.from(cap, { yPercent: 60, autoAlpha: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: scene, start: "top 45%" } });
  });

  // clube
  gsap.fromTo(".club__bg img", { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".club", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.from(".club__content > *", { y: 40, autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: "expo.out", scrollTrigger: { trigger: ".club__content", start: "top 75%" } });

  // galeria anda com a rolagem
  const rail = $(".rail");
  gsap.to(rail, {
    x: () => -(rail.scrollWidth - window.innerWidth), ease: "none",
    scrollTrigger: { trigger: ".gallery", start: "top bottom", end: "bottom top", scrub: 0.5, invalidateOnRefresh: true },
  });

  // unidades
  gsap.from(".unit", { y: 40, autoAlpha: 0, duration: 1, stagger: 0.12, ease: "expo.out", scrollTrigger: { trigger: ".units", start: "top 85%" } });

  window.addEventListener("load", () => ScrollTrigger.refresh());
};

// espera a fonte pra quebrar as linhas certo (no máximo 2,5 s)
let booted = false;
const start = () => { if (!booted) { booted = true; boot(); } };
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(start);
