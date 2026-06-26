// 대안: Cloudflare Worker 실시간 프록시.
// Actions(정적 JSON) 대신 "켜져 있는 백엔드"를 원할 때만 사용.
// 배포: wrangler deploy 후, 대시보드/CLI로 secret 등록 → npx wrangler secret put SERVICE_KEY
// 프론트에서 호출: fetch("https://<your-worker>.workers.dev/?year=2026")
//   응답: {"2026":[["2026-07-17","제헌절"], ...]}

const ENDPOINT = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

const pad = n => String(n).padStart(2, "0");
const isoFrom = s => `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
const pick = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m ? m[1].trim() : ""; };

async function fetchYear(year, key) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const qs = new URLSearchParams({ serviceKey: key, solYear: String(year), solMonth: pad(m), numOfRows: "50", _type: "xml" });
    const res = await fetch(`${ENDPOINT}?${qs}`);
    const xml = await res.text();
    for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) || []) {
      if (pick(it, "isHoliday") === "Y" && pick(it, "locdate")) {
        out.push([isoFrom(pick(it, "locdate")), pick(it, "dateName")]);
      }
    }
  }
  const seen = new Set();
  return out.filter(([d]) => !seen.has(d) && seen.add(d)).sort((a, b) => a[0] < b[0] ? -1 : 1);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",        // 필요하면 본인 github.io 도메인으로 좁히세요
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=86400",
  "Content-Type": "application/json; charset=utf-8",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    if (!env.SERVICE_KEY) return new Response('{"error":"SERVICE_KEY 미설정"}', { status: 500, headers: CORS });
    try {
      const data = { [year]: await fetchYear(year, env.SERVICE_KEY) };
      return new Response(JSON.stringify(data), { headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: CORS });
    }
  },
};
