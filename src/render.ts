import fs from "node:fs/promises";
import path from "node:path";

import { loadConfig, buildViewData, renderSvg } from "./widget.js";

const exportStaticWidget = async () => {
  const config = loadConfig();
  const data = await buildViewData(config);
  const svg = renderSvg(config, data);
  const outDir = path.resolve(process.cwd(), "public");
  await fs.mkdir(outDir, { recursive: true });

  const svgPath = path.join(outDir, "widget.svg");
  await fs.writeFile(svgPath, svg, "utf8");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kitty Fastfetch Widget</title>
    <style>
      body { margin: 0; background: #05070c; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
      body::before { content: ""; position: fixed; inset: 0; background: radial-gradient(circle at top, rgba(255,255,255,0.09), rgba(11,16,22,0)); }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <img src="./widget.svg" alt="Kitty fastfetch widget" />
  </body>
</html>`;

  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");

  process.stdout.write(`Static widget exported to ${svgPath}\n`);
};

exportStaticWidget().catch((error) => {
  console.error(error);
  process.exit(1);
});
