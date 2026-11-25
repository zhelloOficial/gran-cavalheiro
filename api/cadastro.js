// Cadastro do site -> Venda Perfeita (POST /api/site/cadastro).
// A chave do VP mora só aqui (env VP_AGENDA_KEY), nunca no navegador.
// O VP pede o IP de quem preencheu (x-visitante-ip) pra limitar por pessoa.

const VP_URL = (process.env.VP_API_URL || "https://vendaperfeita.com").replace(/\/+$/, "");
const FALHA = "Não deu pra concluir o cadastro agora. Fale com a gente pelo WhatsApp.";

function visitorIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.headers["x-real-ip"] || "").trim();
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: "Origem não permitida" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  // Isca: robô preenche o campo escondido. Finge que deu certo e não manda nada.
  if (text(body.empresa, 200)) return res.status(200).json({ ok: true });

  const key = process.env.VP_AGENDA_KEY;
  if (!key) {
    console.error("[cadastro] VP_AGENDA_KEY não configurada");
    return res.status(503).json({ ok: false, error: FALHA });
  }

  const payload = {
    nome: text(body.nome, 120),
    telefone: text(body.telefone, 40),
    email: text(body.email, 254) || null,
    nascimento: text(body.nascimento, 20) || null,
    comoConheceu: text(body.comoConheceu, 60) || null,
    // Serviço, barbeiro, dia e hora escolhidos: vão pras observações do lead no VP.
    respostas: Array.isArray(body.respostas)
      ? body.respostas
          .slice(0, 8)
          .map((r) => ({ pergunta: text(r && r.pergunta, 120), resposta: text(r && r.resposta, 300) }))
          .filter((r) => r.pergunta && r.resposta)
      : null,
    origem: body.origem && typeof body.origem === "object"
      ? {
          utm_source: text(body.origem.utm_source, 300) || null,
          utm_medium: text(body.origem.utm_medium, 300) || null,
          utm_campaign: text(body.origem.utm_campaign, 300) || null,
          referrer: text(body.origem.referrer, 1000) || null,
        }
      : null,
  };

  try {
    const vp = await fetch(`${VP_URL}/api/site/cadastro`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "x-visitante-ip": visitorIp(req),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const data = await vp.json().catch(() => ({}));
    if (vp.ok && data.success) return res.status(200).json({ ok: true });
    if (data.detalhe) console.error("[cadastro] VP recusou:", vp.status, data.code, data.detalhe);
    return res.status(vp.status >= 500 ? 502 : vp.status).json({ ok: false, error: data.error || FALHA, campo: data.campo || null });
  } catch (err) {
    console.error("[cadastro] VP fora do ar:", err && err.message);
    return res.status(502).json({ ok: false, error: FALHA });
  }
};
