const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProc = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function loadEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

function ensureEnvConfig() {
  const userDir = app.getPath("userData");
  fs.mkdirSync(userDir, { recursive: true });
  const envPath = path.join(userDir, ".env");
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      "# Raimand AI Assistant Configuration\nDATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db\n",
      "utf8"
    );
  }
  return { envPath, envVars: loadEnvFile(envPath) };
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Raimand local server timed out."));
        } else {
          setTimeout(check, 250);
        }
      });
      req.end();
    };
    check();
  });
}

async function startNextServer(port, envVars) {
  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");

  const serverScript = path.join(standaloneDir, "server.js");
  if (!fs.existsSync(serverScript)) {
    throw new Error(`Server bundle not found at: ${serverScript}`);
  }

  serverProc = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ...envVars,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProc.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProc.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
}

async function createWindow() {
  const { envVars } = ensureEnvConfig();
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  await startNextServer(port, envVars);
  await waitForServer(`${baseUrl}/api/health`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "رایمند | دستیار هوش مصنوعی",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(baseUrl)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  await mainWindow.loadURL(baseUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    serverProc.kill("SIGTERM");
    serverProc = null;
  }
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (err) {
    dialog.showErrorBox(
      "Raimand Startup Error",
      err instanceof Error ? err.message : String(err)
    );
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(() => {});
    }
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
