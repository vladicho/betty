import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const output = join(projectRoot, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(projectRoot, "src"), join(output, "src"), { recursive: true });
await cp(join(projectRoot, "web", "app.js"), join(output, "app.js"));
await cp(join(projectRoot, "web", "styles.css"), join(output, "styles.css"));
await cp(join(projectRoot, "web", "index.html"), join(output, "index.html"));

const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY

/src/*
  Cache-Control: public, max-age=3600
`;
await writeFile(join(output, "_headers"), headers, "utf8");

const html = await readFile(join(output, "index.html"), "utf8");
if (!html.includes('src="/app.js"') || !html.includes('href="/styles.css"')) {
  throw new Error("O HTML de producao nao referencia os assets esperados.");
}

console.log("Betty preparado em dist/");
