import "dotenv/config"; // must come first so the database URL is set before Prisma loads
import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { WebSocketServer } from "ws";
import { flushAllRooms, handleConnection } from "./lib/collab/rooms";
import { isAllowedOrigin } from "./lib/collab/origin";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0"; // listen on all interfaces so other devices can connect
const port = Number(process.env.PORT ?? 3000);

// Extra origins allowed to open WebSocket connections (comma-separated).
// Same-host connections are always allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = next({ dev, hostname, port });
const handleRequest = app.getRequestHandler();

function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (i): i is os.NetworkInterfaceInfo =>
        !!i && i.family === "IPv4" && !i.internal,
    )
    .map((i) => i.address);
}

async function main() {
  await app.prepare();
  const handleUpgrade = app.getUpgradeHandler(); // only valid after prepare()

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4 * 1024 * 1024, // 4 MiB per message; anything larger closes that socket
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const match = /^\/ws\/([A-Za-z0-9_-]+)$/.exec(pathname);

    if (!match) {
      // Not our path. In dev, Next.js uses a WebSocket for hot reload,
      // so hand it back instead of dropping it.
      if (dev) void handleUpgrade(req, socket, head);
      else socket.destroy();
      return;
    }

    // Reject connections opened from other websites
    if (!isAllowedOrigin(req.headers.origin, req.headers.host, allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    // The login cookie and document access are checked inside handleConnection,
    // which closes the socket with a specific code if either fails
    const docId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleConnection(ws, docId, req.headers.cookie);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Local:   http://localhost:${port}`);
    for (const ip of lanAddresses()) {
      console.log(`> Network: http://${ip}:${port}`);
    }
  });

  const shutdown = async () => {
    console.log("\nShutting down, saving open documents...");
    await flushAllRooms();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});