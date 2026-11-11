/* Gran Cavalheiro, versão 3 */
(() => {
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

  // aparecer ao rolar
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => io.observe(el));
  } else {
    els.forEach((el) => el.classList.add("is-in"));
  }

  // linha embaixo do topo ao rolar
  const header = document.querySelector(".header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // perguntas: abre e fecha com animação
  document.querySelectorAll(".faq details").forEach((det) => {
    const summary = det.querySelector("summary");
    const body = det.querySelector(".faq__a");
    let anim = null;
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      if (anim) anim.cancel();
      if (det.open) {
        const h = body.offsetHeight;
        det.classList.add("is-closing");
        anim = body.animate([{ height: `${h}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 380, easing: ease });
        anim.onfinish = () => { det.open = false; det.classList.remove("is-closing"); anim = null; };
        summary.querySelector(".i").style.transform = "";
      } else {
        det.open = true;
        const h = body.offsetHeight;
        anim = body.animate([{ height: "0px", opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 480, easing: ease });
        anim.onfinish = () => { anim = null; };
      }
    });
  });

  // unidades: mapa próprio + troca entre Batel e Cabral
  const UNITS = {
    batel: {
      name: "Gran Cavalheiro Batel", short: "Batel", addr: "Av. do Batel, 1700, loja 2",
      coords: [-25.4430601, -49.2894988],
      route: "https://www.google.com/maps/search/?api=1&query=Av.+do+Batel,+1700,+Curitiba",
      label: "Agendar no Batel",
    },
    cabral: {
      name: "Gran Cavalheiro Cabral", short: "Cabral", addr: "Av. Munhoz da Rocha, 752",
      coords: [-25.4093357, -49.2519379],
      route: "https://www.google.com/maps/search/?api=1&query=Av.+Munhoz+da+Rocha,+752,+Curitiba",
      label: "Agendar no Cabral",
    },
  };
  let map = null;
  const mapEl = document.getElementById("map");
  const lngLat = (c) => [c[1], c[0]];
  // cores do mapa no tom da Gran (papel, cobre e grafite)
  const PAINT = [
    ["background", "background-color", "#efe8dc"],
    ["landuse_residential", "fill-color", "#ebe3d5"],
    ["park", "fill-color", "#dfe0cc"],
    ["landcover_wood", "fill-color", "#dcdcc6"],
    ["water", "fill-color", "#cbd5d2"],
    ["waterway", "line-color", "#cbd5d2"],
    ["building", "fill-color", "#e3d9c8"],
    ["highway_minor", "line-color", "#fbf8f2"],
    ["highway_path", "line-color", "#e2d6c3"],
    ["highway_major_casing", "line-color", "#dccdb5"],
    ["highway_major_inner", "line-color", "#fffdf8"],
    ["highway_major_subtle", "line-color", "#fffdf8"],
    ["highway_motorway_casing", "line-color", "#d4b088"],
    ["highway_motorway_inner", "line-color", "#ecd2b2"],
    ["highway_motorway_subtle", "line-color", "#ecd2b2"],
  ];
  if (mapEl && window.maplibregl) {
    map = new maplibregl.Map({
      container: mapEl,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: lngLat(UNITS.batel.coords),
      zoom: 15,
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      PAINT.forEach(([layer, prop, value]) => { try { map.setPaintProperty(layer, prop, value); } catch (e) { /* camada ausente no estilo */ } });
      map.getStyle().layers.filter((l) => l.type === "symbol").forEach((l) => {
        try {
          map.setPaintProperty(l.id, "text-color", "#6b6258");
          map.setPaintProperty(l.id, "text-halo-color", "#f5f1ea");
        } catch (e) { /* camada sem texto */ }
      });
    });
    Object.entries(UNITS).forEach(([key, u]) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `pin${key === "batel" ? " is-active" : ""}`;
      el.dataset.pin = key;
      el.setAttribute("aria-label", `Ver unidade ${u.short} no mapa`);
      el.innerHTML = `<span class="pin__label">${u.short}</span><span class="pin__head"><img src="assets/img/monogram.png" alt=""></span><span class="pin__shadow"></span>`;
      el.addEventListener("click", () => select(key));
      new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(lngLat(u.coords)).addTo(map);
    });
  }

  const tabs = document.querySelectorAll("[data-unit]");
  const route = document.querySelector("[data-route]");
  const book = document.querySelector("[data-book]");
  const card = {
    name: document.querySelector("[data-map-name]"),
    addr: document.querySelector("[data-map-addr]"),
    route: document.querySelector("[data-map-route]"),
  };
  function select(key) {
    const u = UNITS[key];
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.unit === key)));
    document.querySelectorAll("[data-info]").forEach((el) => { el.hidden = el.dataset.info !== key; });
    route.href = u.route;
    book.firstChild.textContent = `${u.label} `;
    card.name.textContent = u.name;
    card.addr.textContent = u.addr;
    card.route.href = u.route;
    document.querySelectorAll("[data-pin]").forEach((p) => p.classList.toggle("is-active", p.dataset.pin === key));
    if (map) map.flyTo({ center: lngLat(u.coords), zoom: 15, duration: 1600, essential: true });
  }
  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab.dataset.unit)));

  // aberto agora, no horário de Curitiba
  const HOURS = { 0: null, 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 18] };
  const DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const paint = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    const now = (Number(get("hour")) % 24) + Number(get("minute")) / 60;
    const today = HOURS[day];
    const open = Boolean(today && now >= today[0] && now < today[1]);
    let text;
    if (open) text = `Aberto agora · até ${today[1]}h`;
    else if (today && now < today[0]) text = `Abre hoje às ${today[0]}h`;
    else {
      let next = (day + 1) % 7;
      while (!HOURS[next]) next = (next + 1) % 7;
      text = `Fechado · abre ${next === (day + 1) % 7 ? "amanhã" : DAYS[next]} às ${HOURS[next][0]}h`;
    }
    document.querySelectorAll("[data-status]").forEach((el) => {
      el.classList.toggle("is-open", open);
      el.classList.toggle("is-closed", !open);
      el.querySelector("b").textContent = text;
    });
    const tt = document.querySelector("[data-status-text]");
    if (tt) tt.textContent = text;
    const dot = document.querySelector("[data-dot]");
    if (dot) dot.classList.toggle("is-closed", !open);
  };
  paint();
  setInterval(paint, 60000);
})();
