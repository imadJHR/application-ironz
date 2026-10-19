// Serveur HTTP de test (updates-e2e / smoke) simulant l'API GitHub
// Releases. Le comportement est piloté par un fichier d'état relu à
// chaque requête : aucun redémarrage de serveur de test nécessaire.
// Modes : release (payload JSON), none (404), offline (socket coupée),
// neterror (500), badjson (corps text/html invalide).
import http from "node:http";
import fs from "node:fs";

export async function startUpdateMock(stateFile, port = 4391) {
  const counters = { get: 0, post: 0, other: 0 };
  const server = http.createServer((req, res) => {
    counters[req.method === "GET" ? "get" : req.method === "POST" ? "post" : "other"]++;
    if (new URL(req.url, "http://x").pathname !== "/api/latest") {
      res.statusCode = 404;
      return res.end();
    }
    let state = { mode: "neterror" };
    try {
      const raw = fs.readFileSync(stateFile, "utf8");
      if (raw.trim()) state = JSON.parse(raw);
    } catch {
      state = { mode: "neterror" };
    }
    if (state.mode === "offline") {
      res.socket.destroy();
      return;
    }
    if (state.mode === "neterror") {
      res.writeHead(500, { "content-type": "text/plain" });
      return res.end("erreur simulée");
    }
    if (state.mode === "badjson") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end("<html>ceci n'est pas du json</html>");
    }
    if (state.mode === "none") {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end('{"message":"Not Found"}');
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(state.release || {}));
  });
  await new Promise((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return { server, counters, close: () => server.close() };
}
