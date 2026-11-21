const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, nativeImage, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProc = null;
let tray = null;
let isQuitting = false;
let appBaseUrl = "";

const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAKklEQVR4nGP8z8DAwMDAxMDAwMDwHwYGJgYmBigY1TBq2Khho4aNGjZIAAB/wQMB14a0ZQAAAABJRU5ErkJggg==";

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

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function setupTray() {
  if (tray) return;
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip("Raimand AI Assistant (رایمند)");
  const menu = Menu.buildFromTemplate([
    {
      label: "نمایش / مخفی‌سازی رایمند (Alt+Space)",
      click: () => toggleWindow(),
    },
    {
      label: "مقایسه مدل‌ها (Arena)",
      click: () => {
        if (mainWindow && appBaseUrl) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.loadURL(`${appBaseUrl}/arena`).catch(() => {});
        }
      },
    },
    { type: "separator" },
    {
      label: "خروج کامل (Quit)",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => toggleWindow());
}

function registerShortcuts() {
  const shortcuts = ["Alt+Space", "CommandOrControl+Shift+R"];
  for (const sc of shortcuts) {
    try {
      globalShortcut.register(sc, () => toggleWindow());
    } catch {
      /* ignore if taken by OS */
    }
  }
}

async function createWindow() {
  const { envVars } = ensureEnvConfig();
  const port = await getFreePort();
  appBaseUrl = `http://127.0.0.1:${port}`;

  await startNextServer(port, envVars);
  await waitForServer(`${appBaseUrl}/api/health`);

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
    if (!url.startsWith(appBaseUrl)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "رایمند در پس‌زمینه فعال است",
          body: "برای باز کردن سریع از Alt+Space یا آیکون کنار ساعت استفاده کنید.",
        }).show();
      }
    }
  });

  await mainWindow.loadURL(appBaseUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setupTray();
  registerShortcuts();
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
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(() => {});
    }
  });
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    stopServer();
    if (process.platform !== "darwin") app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  stopServer();
});
