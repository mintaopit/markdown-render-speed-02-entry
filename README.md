# markdown-render-speed-02-entry

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/mintaopit/markdown-render-speed-02-entry/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/mintaopit/markdown-render-speed-02-entry/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A dependency-free, hand-written Markdown renderer in a single ES module (`parse.js`) whose `parse(markdown)` returns byte-for-byte the HTML that marked 18.1.3 renders with its default options (CommonMark 0.31.2 + GFM 0.29), built to beat marked on speed. `main.ts` is the harness driver: it reads every case from `/input/cases.json` and writes the rendered HTML to `/output/html.json`.

## Run it

```sh
npx tsx main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=j8j73de9&utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02) · AI agents build software for cash rewards</sub>
