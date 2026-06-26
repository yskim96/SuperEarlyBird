# 근무시간 정산기 · 선택적 근로시간제

월 단위 정산 선택근로제에서 **그 달 몇 시에 퇴근하면 기준근로시간을 채우는지**, 그리고
**균등배분 vs 8시간 절벽 회피** 중 뭐가 유리한지 계산하는 단일 페이지 앱.

- 정적 호스팅(GitHub Pages)만으로 동작. 런타임 백엔드 0개.
- 공휴일은 **한국천문연구원 특일정보 API**를 GitHub Actions가 주기적으로 가져와 `holidays.json`에 캐싱.
- `holidays.json`이 없거나 못 불러도 **내장 폴백(2026·2027 검증치)**로 즉시 동작.

## 계산 규칙

| 항목 | 식 |
|---|---|
| 월 기준근로시간 | ⌊역일수 ÷ 7 × 40⌋ − (평일 공휴일수 × 8h)  ※소수점 버림 |
| 월 최대근로시간 | ⌊역일수 ÷ 7 × 52⌋  ※소수점 버림 |
| 자동 휴게 | 실근무 4시간당 30분 (8h 미만 = 30분, 8h 이상 = 60분) |
| 퇴근시각 | 출근 + 근무 + 휴게 |
| 셋째 주 금요일 | "세 번째 월요일이 있는 주의 금요일" (사내 정의) |

근로자의날(5/1)은 관공서 공휴일이 아니라 API에 안 나오므로 앱 토글로 처리.

## 파일

```
index.html                            계산기 (이거 하나로 끝)
holidays.json                         공휴일 캐시 (씨앗: 2026·2027)
scripts/fetch_holidays.mjs            천문연 API → holidays.json (Node 18+, 무의존성)
.github/workflows/update-holidays.yml 매월 자동 갱신 워크플로
worker.js                             (선택) Cloudflare Worker 실시간 프록시 대안
```

## 배포 (GitHub Pages + Actions)

1. 이 폴더를 레포에 푸시.
2. **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SERVICE_KEY`
   - Value: data.go.kr **일반 인증키(Decoding)** 값
3. **Settings → Pages →** Source를 `main` 브랜치 루트로 설정.
4. **Actions 탭 → Update holidays.json → Run workflow** 한 번 수동 실행 → `holidays.json`이 모든 연도로 채워짐.
5. 이후 매월 1일 자동 갱신. 대체공휴일·임시공휴일은 관보 공포 후 API에 반영되면 따라옴.

로컬 미리보기: `python3 -m http.server` 후 `localhost:8000`.
(파일을 `file://`로 직접 열면 `holidays.json` fetch가 막혀 내장 폴백으로 동작 — 2026·2027은 정상.)

## 보안

- **API 키는 `SERVICE_KEY` Secret에만** 둡니다. `index.html`·`holidays.json` 어디에도 키가 들어가지 않습니다 (브라우저는 결과 JSON만 받음).
- 이 프로젝트를 만들며 채팅에 한 번 노출된 키가 있다면 **data.go.kr에서 재발급(폐기 후 새 키)** 받아 Secret에 넣으세요.
- Worker를 쓸 경우 `Access-Control-Allow-Origin`을 본인 `*.github.io` 도메인으로 좁히는 걸 권장.

## 대안 백엔드 (worker.js)

상시 응답하는 백엔드가 필요하면 Cloudflare Worker로 띄우고, `index.html`의 `loadHolidays()`가
`fetch("holidays.json")` 대신 `fetch("https://<worker>.workers.dev/?year="+y)`를 부르도록 바꾸면 됩니다.
무료 티어(100k req/day)로 충분하고 콜드스타트가 없습니다. 다만 공휴일은 거의 안 바뀌니
대부분의 경우 Actions(정적 JSON)가 더 단순하고 빠릅니다.

## 직접 수정

- 공휴일 누락/임시공휴일: 앱 하단에서 날짜 추가/삭제 가능 (그 세션 한정).
- 영구 반영하려면 `holidays.json`을 직접 편집하거나 Action을 다시 실행.
