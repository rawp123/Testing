const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = __dirname;
const port = Number.parseInt(process.env.PORT || "3104", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function resolveRequestPath(requestUrl) {
  const parsedUrl = new URL(requestUrl || "/", `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(rootDir, relativePath);

  if (!filePath.startsWith(`${rootDir}${path.sep}`) && filePath !== rootDir) {
    return "";
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

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
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Home Basis Tracker website: http://127.0.0.1:${port}`);
});
