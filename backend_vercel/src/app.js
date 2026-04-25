const cors = require("cors");
const { CORS_ORIGIN } = require("./config");
const {
  getBootstrapPayload,
  getOwnerPackages,
  getRegionPackages,
  getProvincePackages,
} = require("./dashboard-repository");

function resolveCorsOrigin() {
  if (CORS_ORIGIN === "*") return "*";
  return CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
}

function createApp(db) {
  const corsMiddleware = cors({ origin: resolveCorsOrigin() });

  return async function handler(req, res) {
    await new Promise((resolve) => corsMiddleware(req, res, resolve));

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.replace(/^\/api/, "");

    try {
      if (req.method === "GET" && pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.method === "GET" && pathname === "/bootstrap") {
        const payload = await getBootstrapPayload(db);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        return;
      }

      const regionMatch = pathname.match(/^\/regions\/([^/]+)\/packages$/);
      if (req.method === "GET" && regionMatch) {
        const payload = await getRegionPackages(db, decodeURIComponent(regionMatch[1]), Object.fromEntries(url.searchParams));
        if (!payload) { res.writeHead(404); res.end(JSON.stringify({ error: "Region not found" })); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        return;
      }

      const provinceMatch = pathname.match(/^\/provinces\/([^/]+)\/packages$/);
      if (req.method === "GET" && provinceMatch) {
        const payload = await getProvincePackages(db, decodeURIComponent(provinceMatch[1]), Object.fromEntries(url.searchParams));
        if (!payload) { res.writeHead(404); res.end(JSON.stringify({ error: "Province not found" })); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        return;
      }

      if (req.method === "GET" && pathname === "/owners/packages") {
        const ownerType = (url.searchParams.get("ownerType") || "").trim();
        const ownerName = (url.searchParams.get("ownerName") || "").trim();
        if (!ownerType || !ownerName) { res.writeHead(400); res.end(JSON.stringify({ error: "ownerType and ownerName are required" })); return; }
        const payload = await getOwnerPackages(db, Object.fromEntries(url.searchParams));
        if (!payload) { res.writeHead(404); res.end(JSON.stringify({ error: "Owner not found" })); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  };
}

module.exports = { createApp };