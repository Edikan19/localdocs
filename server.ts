import "dotenv/config"; // must come first so the database URL is set before Prisma loads
import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { WebSocketServer } from "ws";
import { flushAllRooms, handleConnection } from "./lib/collab/rooms";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0"; // listen on all interfaces so other devices can connect
const port = Number(process.env.PORT ?? 3000);

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

  const wss = new WebSocketServer({ noServer: true });

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

    const docId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleConnection(ws, docId);
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