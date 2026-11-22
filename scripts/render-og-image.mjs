import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const rikaBase64 = 'data:image/png;base64,' + fs.readFileSync('scripts/rika.png').toString('base64');
const meme1Base64 = 'data:image/png;base64,' + fs.readFileSync('scripts/memes/meme1.png').toString('base64');
const meme2Base64 = 'data:image/png;base64,' + fs.readFileSync('scripts/memes/meme2.png').toString('base64');
const meme3Base64 = 'data:image/webp;base64,' + fs.readFileSync('scripts/memes/meme3.webp').toString('base64');
const meme4Base64 = 'data:image/png;base64,' + fs.readFileSync('scripts/memes/meme4.png').toString('base64');
const meme5Base64 = 'data:image/png;base64,' + fs.readFileSync('scripts/memes/meme5.png').toString('base64');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #151829;
    font-family: "Comic Sans MS", "Comic Sans", "Chalkboard SE", "Comic Neue", cursive, sans-serif;
    color: #eef2ff;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: stretch;
    padding: 0;
  }

  /* Subtle flat grid matching Furude Rika's indigo/periwinkle hair & outfit */
  .flat-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle at 1px 1px, rgba(165, 180, 252, 0.09) 1.2px, transparent 0);
    background-size: 24px 24px;
    pointer-events: none;
  }

  /* Crisp Meme Sprinkles (Background detail, varied sizes, no blur) */
  .meme-sticker {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    opacity: 0.88;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.55));
  }
  .meme-deep {
    z-index: 1;
    opacity: 0.65;
  }

  .ms-1 { top: 18px; left: 30px; width: 62px; transform: rotate(-10deg); }
  .ms-2 { top: 12px; left: 160px; width: 34px; transform: rotate(8deg); }
  .ms-3 { top: 35px; left: 280px; width: 85px; transform: rotate(-15deg); }
  .ms-4 { top: 14px; left: 430px; width: 44px; transform: rotate(12deg); }
  .ms-5 { top: 16px; left: 560px; width: 70px; transform: rotate(-8deg); }
  .ms-6 { top: 10px; right: 440px; width: 36px; transform: rotate(14deg); }
  .ms-7 { top: 18px; right: 290px; width: 82px; transform: rotate(-6deg); }
  .ms-8 { top: 14px; right: 140px; width: 42px; transform: rotate(10deg); }
  .ms-9 { top: 22px; right: 30px; width: 95px; transform: rotate(-12deg); }

  .ms-10 { top: 120px; left: 18px; width: 55px; transform: rotate(15deg); }
  .ms-11 { top: 210px; left: 25px; width: 90px; transform: rotate(-8deg); }
  .ms-12 { top: 320px; left: 12px; width: 38px; transform: rotate(12deg); }
  .ms-13 { top: 410px; left: 30px; width: 75px; transform: rotate(-14deg); }
  .ms-14 { bottom: 85px; left: 14px; width: 45px; transform: rotate(10deg); }
  .ms-15 { bottom: 20px; left: 25px; width: 88px; transform: rotate(-6deg); }

  .ms-16 { bottom: 15px; left: 170px; width: 35px; transform: rotate(12deg); }
  .ms-17 { bottom: 25px; left: 320px; width: 68px; transform: rotate(-10deg); }
  .ms-18 { bottom: 18px; left: 460px; width: 48px; transform: rotate(8deg); }
  .ms-19 { bottom: 22px; right: 480px; width: 92px; transform: rotate(-14deg); }
  .ms-20 { bottom: 16px; right: 350px; width: 38px; transform: rotate(10deg); }
  .ms-21 { bottom: 24px; right: 210px; width: 72px; transform: rotate(-8deg); }
  .ms-22 { bottom: 18px; right: 45px; width: 105px; transform: rotate(6deg); }

  .ms-23 { top: 130px; right: 22px; width: 40px; transform: rotate(-12deg); }
  .ms-24 { top: 230px; right: 16px; width: 78px; transform: rotate(14deg); }
  .ms-25 { top: 340px; right: 24px; width: 34px; transform: rotate(-10deg); }
  .ms-26 { bottom: 160px; right: 15px; width: 82px; transform: rotate(12deg); }

  .ms-27 { top: 160px; left: 420px; width: 110px; transform: rotate(16deg); }
  .ms-28 { top: 290px; left: 380px; width: 46px; transform: rotate(-18deg); }
  .ms-29 { top: 90px; right: 240px; width: 32px; transform: rotate(-15deg); }
  .ms-30 { bottom: 220px; right: 420px; width: 42px; transform: rotate(12deg); }
  .ms-31 { bottom: 120px; left: 490px; width: 95px; transform: rotate(-8deg); }
  .ms-32 { top: 460px; right: 280px; width: 50px; transform: rotate(14deg); }

  /* Layout container */
  .layout-container {
    position: relative;
    z-index: 5;
    display: flex;
    width: 100%;
    height: 100%;
  }

  /* Left side: Furude Rika shifted towards the middle */
  .left-side {
    width: 440px;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    padding-left: 95px;
    flex-shrink: 0;
    position: relative;
  }

  .rika-sprite {
    height: 610px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.7));
    position: relative;
    z-index: 6;
  }

  /* Right side: sample node connection card + title below */
  .right-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 26px;
    padding: 30px 42px 30px 10px;
    position: relative;
    z-index: 7;
  }

  /* Sample node connection card */
  .graph-card {
    width: 100%;
    max-width: 610px;
    height: 335px;
    background: #1c2038;
    border: 2px solid #333d6b;
    border-radius: 12px;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }

  .graph-card-header {
    height: 34px;
    background: #141728;
    border-bottom: 1.5px solid #333d6b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.05em;
  }

  .window-dots {
    display: flex;
    gap: 6px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #333d6b;
  }
  .dot.pink { background: #f472b6; }

  .graph-canvas {
    position: relative;
    width: 100%;
    height: calc(100% - 34px);
    background-image: radial-gradient(circle at 1px 1px, rgba(165, 180, 252, 0.06) 1.2px, transparent 0);
    background-size: 20px 20px;
  }

  /* Nodes */
  .mock-node {
    position: absolute;
    width: 195px;
    padding: 9px 12px;
    background: #232847;
    border: 2px solid #3e4c85;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .mock-node.hub {
    top: 76px;
    left: 28px;
    border-color: #f472b6;
    box-shadow: 0 0 18px rgba(244, 114, 182, 0.3), 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  .mock-node.node1 {
    top: 32px;
    left: 360px;
    border-color: #6366f1;
  }
  .mock-node.node2 {
    top: 176px;
    left: 360px;
    border-color: #6366f1;
  }

  .n-head {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .n-id {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: #c7d2fe;
  }
  .mock-node.hub .n-id {
    background: #f472b6;
    color: #151829;
  }
  .n-title {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .n-tags {
    display: flex;
    gap: 5px;
  }
  .n-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
    color: #c7d2fe;
  }
  .n-tag.hub-tag {
    background: rgba(244, 114, 182, 0.22);
    color: #fbcfe8;
    border: 1px solid rgba(244, 114, 182, 0.4);
  }
  .n-tag.all-tag {
    background: rgba(99, 102, 241, 0.22);
    color: #c7d2fe;
    border: 1px solid rgba(99, 102, 241, 0.4);
  }

  .canvas-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* Below sample node connection: title only */
  .title-under {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #ffffff;
    text-align: center;
    text-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  }
  .title-under span {
    color: #f472b6;
  }
</style>
</head>
<body>
  <div class="flat-grid"></div>

  <!-- Crisp Small Meme Detail Stickers (Multiple copies, varied sizes, background detail) -->
  <img class="meme-sticker ms-1" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-2" src="${meme4Base64}" alt="meme" />
  <img class="meme-sticker ms-3" src="${meme2Base64}" alt="meme" />
  <img class="meme-sticker ms-4" src="${meme5Base64}" alt="meme" />
  <img class="meme-sticker ms-5" src="${meme3Base64}" alt="meme" />
  <img class="meme-sticker ms-6" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-7" src="${meme4Base64}" alt="meme" />
  <img class="meme-sticker ms-8" src="${meme2Base64}" alt="meme" />
  <img class="meme-sticker ms-9" src="${meme3Base64}" alt="meme" />
  <img class="meme-sticker ms-10" src="${meme5Base64}" alt="meme" />
  <img class="meme-sticker ms-11" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-12" src="${meme4Base64}" alt="meme" />
  <img class="meme-sticker ms-13" src="${meme5Base64}" alt="meme" />
  <img class="meme-sticker ms-14" src="${meme2Base64}" alt="meme" />
  <img class="meme-sticker ms-15" src="${meme3Base64}" alt="meme" />
  <img class="meme-sticker ms-16" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-17" src="${meme4Base64}" alt="meme" />
  <img class="meme-sticker ms-18" src="${meme2Base64}" alt="meme" />
  <img class="meme-sticker ms-19" src="${meme5Base64}" alt="meme" />
  <img class="meme-sticker ms-20" src="${meme3Base64}" alt="meme" />
  <img class="meme-sticker ms-21" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-22" src="${meme4Base64}" alt="meme" />
  <img class="meme-sticker ms-23" src="${meme2Base64}" alt="meme" />
  <img class="meme-sticker ms-24" src="${meme5Base64}" alt="meme" />
  <img class="meme-sticker ms-25" src="${meme3Base64}" alt="meme" />
  <img class="meme-sticker ms-26" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-27" src="${meme4Base64}" alt="meme" />
  <img class="meme-sticker ms-28" src="${meme2Base64}" alt="meme" />
  <img class="meme-sticker ms-29" src="${meme5Base64}" alt="meme" />
  <img class="meme-sticker ms-30" src="${meme3Base64}" alt="meme" />
  <img class="meme-sticker ms-31" src="${meme1Base64}" alt="meme" />
  <img class="meme-sticker ms-32" src="${meme2Base64}" alt="meme" />

  <div class="layout-container">
    <!-- Left side: Furude Rika takes most of the screen -->
    <div class="left-side">
      <img class="rika-sprite" src="${rikaBase64}" alt="Furude Rika" />
    </div>

    <!-- Right side: Sample node connection and title below -->
    <div class="right-side">
      <div class="graph-card">
        <div class="graph-card-header">
          <span>// GRAPHIC DESIGN IS MY SHIT</span>
          <div class="window-dots">
            <div class="dot pink"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        </div>

        <div class="graph-canvas">
          <svg class="canvas-svg" width="610" height="301">
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#818cf8" />
              </marker>
            </defs>

            <!-- Edge from Hub to East Corridor -->
            <path d="M 223 104 C 285 104, 305 60, 358 60" stroke="#818cf8" stroke-width="2.5" fill="none" marker-end="url(#arrow)" />
            <!-- Edge from Hub to Courtyard Garden -->
            <path d="M 223 118 C 285 118, 305 204, 358 204" stroke="#818cf8" stroke-width="2.5" fill="none" marker-end="url(#arrow)" />
          </svg>

          <!-- Hub Node -->
          <div class="mock-node hub">
            <div class="n-head">
              <span class="n-id">#0</span>
              <span class="n-title">WS Lambda RP Hub</span>
            </div>
            <div class="n-tags">
              <span class="n-tag hub-tag">HUB</span>
              <span class="n-tag all-tag">&lt;ALL&gt;</span>
            </div>
          </div>

          <!-- Node 1 -->
          <div class="mock-node node1">
            <div class="n-head">
              <span class="n-id">#1</span>
              <span class="n-title">East Corridor</span>
            </div>
            <div class="n-tags">
              <span class="n-tag">2 EXITS</span>
              <span class="n-tag">indoors</span>
            </div>
          </div>

          <!-- Node 2 -->
          <div class="mock-node node2">
            <div class="n-head">
              <span class="n-id">#2</span>
              <span class="n-title">Courtyard Garden</span>
            </div>
            <div class="n-tags">
              <span class="n-tag">OUTDOORS</span>
              <span class="n-tag">TOD: 3</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Below sample node connection: title only -->
      <div class="title-under">
        Visual Node Graph &amp; <span>Background Maker</span>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('scripts/generate-og-image.html', html, 'utf8');

// Render using headless Chrome
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(8094, () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const outDoc = path.resolve('docs/og-image.png');
  const outPublic = path.resolve('public/og-image.png');
  const outExport = path.resolve('export/og-image.png');
  const outArtifact = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\3189314c-7a18-42e5-ab0c-aba948813dfc\\verified_rika_meme_og_image.png';

  const cp = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1200,630',
    `--screenshot=${outDoc}`,
    'http://localhost:8094'
  ]);

  cp.on('close', () => {
    fs.copyFileSync(outDoc, outPublic);
    if (fs.existsSync(path.dirname(outExport))) {
      fs.copyFileSync(outDoc, outExport);
    }
    fs.copyFileSync(outDoc, outArtifact);
    console.log('Successfully generated og-image.png to docs, public, export, and artifact directory!');
    server.close();
    process.exit(0);
  });
});
