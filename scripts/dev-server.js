/**
 * Minimal static dev server (no dependencies) for Phase 2 hotseat play.
 *
 * Serves the repo root so the client's ES-module imports of /shared resolve:
 *   npm run dev  →  http://localhost:8080/  (serves client/index.html)
 *
 * Phase 3 replaces this with server/index.js (static files + WebSocket).
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT ?? 8080);

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".pdf": "application/pdf",
    ".md": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
};

http.createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (path === "/") {
            // Redirect instead of rewriting so the page's relative URLs
            // (css/…, js/…) resolve against /client/.
            res.writeHead(302, { location: "/client/" });
            res.end();
            return;
        }
        if (path.endsWith("/")) path += "index.html";
        const file = resolve(join(ROOT, path));
        if (!file.startsWith(ROOT + sep)) throw new Error("outside root");
        const data = await readFile(file);
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
        res.end(data);
    } catch {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
    }
}).listen(PORT, () => {
    console.log(`Truqué dev server → http://localhost:${PORT}/`);
});
