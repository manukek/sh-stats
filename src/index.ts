import http from "http";
import { loadConfig, buildViewData, renderSvg } from "./widget.js";

const config = loadConfig();

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request");
    return;
  }
  if (req.url.startsWith("/health")) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  try {
    const data = await buildViewData(config);
    const svg = renderSvg(config, data);
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    });
    res.end(svg);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(config.port, () => {
  process.stdout.write(`Widget running on http://localhost:${config.port}\n`);
});
