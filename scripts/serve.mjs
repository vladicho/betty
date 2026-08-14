import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

createServer(async (request, response) => {
  const webAssets = new Set(["/app.js", "/import-worker.js", "/styles.css"]);
  const requested = request.url === "/" ? "/web/index.html" : webAssets.has(request.url) ? `/web${request.url}` : request.url;
  const relative = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, relative);
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": `${types[extname(file)] || "application/octet-stream"}; charset=utf-8` });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => console.log(`Betty em http://localhost:${port}`));
