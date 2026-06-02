import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT || "3102", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

function resolveRequestPath(requestUrl) {
  const parsedUrl = new URL(requestUrl || "/", `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  let relativePath = pathname === "/" || pathname === "/index.html" ? "frontend/index.html" : pathname.replace(/^\/+/, "");
  if (relativePath === "app.js" || relativePath === "styles.css") {
    relativePath = `frontend/${relativePath}`;
  }
  let filePath = path.resolve(productRoot, relativePath);

  if (!filePath.startsWith(`${productRoot}${path.sep}`) && filePath !== productRoot) {
    return "";
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  return filePath;
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Home Basis Tracker frontend: http://127.0.0.1:${port}`);
});
