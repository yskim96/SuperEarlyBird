#!/usr/bin/env node
// 한국천문연구원 특일정보 getRestDeInfo → holidays.json
// 키는 환경변수 SERVICE_KEY (data.go.kr "일반 인증키 Decoding")로 주입. 절대 커밋하지 말 것.
// 실행: SERVICE_KEY=xxxx node scripts/fetch_holidays.mjs
// 의존성 없음 (Node 18+ 내장 fetch 사용).

import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.SERVICE_KEY;
if (!KEY) { console.error("SERVICE_KEY 환경변수가 없습니다."); process.exit(1); }

const ENDPOINT = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
const OUT = new URL("../holidays.json", import.meta.url);

// 갱신 범위: 항상 2026·2027 + 올해-1 ~ 올해+3
const now = new Date().getFullYear();
const years = [...new Set([2026, 2027, ...Array.from({length:5},(_,i)=>now-1+i)])].sort();

const pad = n => String(n).padStart(2,"0");
const isoFrom = s => `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
const pick = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m ? m[1].trim() : ""; };

async function fetchMonth(year, month){
  const qs = new URLSearchParams({ serviceKey: KEY, solYear:String(year), solMonth:pad(month), numOfRows:"50", _type:"xml" });
  const res = await fetch(`${ENDPOINT}?${qs}`);
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${year}-${pad(month)}`);
  const xml = await res.text();
  if(/<errMsg>|<returnReasonCode>/.test(xml) && !/<items>/.test(xml)){
    throw new Error(`API error ${year}-${pad(month)}: ${pick(xml,"returnAuthMsg")||pick(xml,"errMsg")}`);
  }
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.map(it => ({ isHoliday: pick(it,"isHoliday"), name: pick(it,"dateName"), locdate: pick(it,"locdate") }))
              .filter(x => x.isHoliday === "Y" && x.locdate)
              .map(x => [isoFrom(x.locdate), x.name]);
}

async function main(){
  // 기존 파일 로드(병합 보존). 없으면 빈 객체.
  let data = {};
  try { data = JSON.parse(await readFile(OUT,"utf8")); } catch {}

  for(const y of years){
    const all = [];
    for(let m=1;m<=12;m++){
      try { all.push(...await fetchMonth(y,m)); }
      catch(e){ console.warn("  ! "+e.message); }
      await new Promise(r=>setTimeout(r,120)); // 살짝 텀
    }
    if(all.length){
      // 중복 제거 + 정렬
      const seen=new Set(); const merged=[];
      for(const [d,n] of all){ if(!seen.has(d)){ seen.add(d); merged.push([d,n]); } }
      merged.sort((a,b)=>a[0]<b[0]?-1:1);
      data[String(y)] = merged;
      console.log(`${y}: ${merged.length}건`);
    } else {
      console.warn(`${y}: 0건 (기존값 유지)`);
    }
  }

  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("→ holidays.json 갱신 완료");
}
main().catch(e=>{ console.error(e); process.exit(1); });
