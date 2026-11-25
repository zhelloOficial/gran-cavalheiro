// Serviços, barbeiros e horários livres da Gran, lidos do Venda Perfeita.
// O VP já junta o que está ocupado no Cash Barber (extensão no Chrome 24h),
// então só sai horário vago de verdade.
//
// GET /api/agenda?op=catalogo
// GET /api/agenda?op=dias&servico=<id>&profissional=<p_...>&de=AAAA-MM-DD&ate=AAAA-MM-DD
// GET /api/agenda?op=horarios&servico=<id>&profissional=<p_...>&data=AAAA-MM-DD
//
// A chave do VP mora só aqui (env VP_AGENDA_KEY), nunca no navegador.

const VP_URL = (process.env.VP_API_URL || "https://vendaperfeita.com").replace(/\/+$/, "");
const FALHA = "Não deu pra carregar os horários agora. Fale com a gente pelo WhatsApp.";

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Catálogo muda pouco; horário livre precisa ser fresco.
const CACHE = { catalogo: "public, s-maxage=300, stale-while-revalidate=600", dias: "public, s-maxage=30", horarios: "public, s-maxage=20" };

function pick(query, name, pattern) {
  const raw = query[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === "") return { ok: true, value: null };
  return typeof value === "string" && pattern.test(value) ? { ok: true, value } : { ok: false };
}

function vpPath(query) {
  const op = query.op;
  if (op === "catalogo") return { op, path: "/api/site/agenda" };
  if (op !== "dias" && op !== "horarios") return null;
  const servico = pick(query, "servico", ID);
  const profissional = pick(query, "profissional", ID);
  if (!servico.ok || !servico.value || !profissional.ok) return null;
  const params = new URLSearchParams({ servico: servico.value });
  if (profissional.value) params.set("profissional", profissional.value);
  if (op === "dias") {
    const de = pick(query, "de", DAY);
    const ate = pick(query, "ate", DAY);
    if (!de.ok || !ate.ok) return null;
    if (de.value) params.set("de", de.value);
    if (ate.value) params.set("ate", ate.value);
    return { op, path: `/api/site/agenda/dias?${params}` };
  }
  const data = pick(query, "data", DAY);
  if (!data.ok || !data.value) return null;
  params.set("data", data.value);
  return { op, path: `/api/site/agenda/horarios?${params}` };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }
  const target = vpPath(req.query || {});
  if (!target) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ ok: false, error: "Escolha o serviço e o dia de novo." });
  }

  const key = process.env.VP_AGENDA_KEY;
  if (!key) {
    console.error("[agenda] VP_AGENDA_KEY não configurada");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ ok: false, error: FALHA });
  }

  try {
    const vp = await fetch(`${VP_URL}${target.path}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await vp.json().catch(() => ({}));
    if (vp.ok && body.success) {
      res.setHeader("Cache-Control", CACHE[target.op]);
      return res.status(200).json({ ok: true, data: body.data });
    }
    if (body.detalhe) console.error("[agenda] VP recusou:", vp.status, body.code, body.detalhe);
    res.setHeader("Cache-Control", "no-store");
    return res.status(vp.status >= 500 ? 502 : vp.status).json({ ok: false, error: body.error || FALHA, code: body.code || null });
  } catch (err) {
    console.error("[agenda] VP fora do ar:", err && err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ ok: false, error: FALHA });
  }
};

module.exports.vpPath = vpPath;
