# Evidence ledger

| # | Claim | Type | Source / method | Status |
|---|---|---|---|---|
| E1 | Users want a broad library to audition quickly | Assumption (client-supplied) | Echo's request, 2026-09-28 | Supplied |
| E2 | WebCodecs + mp4-muxer 5.2.2 / webm-muxer 5.1.4 / fflate 0.8.3 UMD builds exist | Fact | `npm pack` inspection of build/ and umd/ paths | Verified |
| E3 | Published artifacts can only hand files over via the downloads capability | Fact | Runtime contract 0.2.61 downloads.d.ts | Verified |
| E4 | Pure-function styles loop seamlessly | Hypothesis | Pixel diff frame 0 vs frame N per style (tests/e2e) | See verify report |
| E5 | 60 fps preview at stage size | Hypothesis | Frame-time probe per style in headless Chromium | See performance review |
| E6 | Controls are not overwhelming | Hypothesis | Grouped, collapsible inspector; untested with users | Unverified — needs a session with 2–3 designers |
