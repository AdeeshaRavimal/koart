/**
 * KOart Desktop (Electron) — wraps the platform server in a native window.
 * Supports Instant In-App Hot-Updates (<1MB app.asar download & 2-sec restart).
 * Data is stored in the user's app-data folder; 7-day trial starts on first run.
 */
const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const pkg = require('../package.json');

const TRIAL_DAYS = 7;

function isNewerVersion(remote, local) {
  const r = (remote || '').split('.').map(Number);
  const l = (local || '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

function getActiveVersion() {
  try {
    const enginePkg = path.join(app.getPath('userData'), 'engine', 'app.asar', 'package.json');
    if (fs.existsSync(enginePkg)) {
      const p = JSON.parse(fs.readFileSync(enginePkg, 'utf8'));
      if (p && p.version) return p.version;
    }
  } catch (e) {}
  return pkg.version || '1.2.0';
}

function fetchRemotePackage() {
  return new Promise((resolve) => {
    const urls = [
      'https://raw.githubusercontent.com/AdeeshaRavimal/koart/main/updates/version.json',
      'https://raw.githubusercontent.com/AdeeshaRavimal/koart/main/package.json'
    ];

    function tryFetch(idx) {
      if (idx >= urls.length) return resolve(null);
      const targetUrl = urls[idx] + '?t=' + Date.now();
      try {
        const parsed = new URL(targetUrl);
        const client = parsed.protocol === 'https:' ? https : http;

        client.get(targetUrl, { headers: { 'User-Agent': 'KOart-Desktop-App' }, timeout: 5000 }, (res) => {
          if (res.statusCode !== 200) return tryFetch(idx + 1);
          let raw = '';
          res.on('data', chunk => raw += chunk);
          res.on('end', () => {
            try {
              const data = JSON.parse(raw);
              resolve(data);
            } catch (e) {
              tryFetch(idx + 1);
            }
          });
        }).on('error', () => tryFetch(idx + 1));
      } catch (err) {
        tryFetch(idx + 1);
      }
    }

    tryFetch(0);
  });
}

function downloadFileWithProgress(sourceUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(sourceUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      client.get(sourceUrl, { headers: { 'User-Agent': 'KOart-Updater' } }, (res) => {
        // Handle HTTP Redirects (e.g. GitHub Releases 302 to S3 CDN)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadFileWithProgress(res.headers.location, destPath, onProgress)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Server returned HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && typeof onProgress === 'function') {
            const pct = Math.round((downloadedBytes / totalBytes) * 100);
            onProgress(pct);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath));
        });

        fileStream.on('error', (err) => {
          try { fs.unlinkSync(destPath); } catch (e) {}
          reject(err);
        });
      }).on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

// ----------------------------------------------------------------------------
// IPC AUTO-UPDATER HANDLERS
// ----------------------------------------------------------------------------
ipcMain.handle('check-update', async () => {
  const remote = await fetchRemotePackage();
  if (!remote || !remote.version) {
    return { success: false, error: 'Could not connect to update servers.' };
  }
  const currentVer = getActiveVersion();
  const isAvailable = isNewerVersion(remote.version, currentVer);
  return {
    success: true,
    updateAvailable: isAvailable,
    currentVersion: currentVer,
    newVersion: remote.version,
    releaseNotes: remote.description || 'Instant performance enhancements, bug fixes, and security updates.',
    asarUrl: `https://raw.githubusercontent.com/AdeeshaRavimal/koart/main/updates/app.asar`,
    fallbackAsarUrl: `https://github.com/AdeeshaRavimal/koart/releases/download/v${remote.version}/app.asar`
  };
});

ipcMain.handle('apply-update', async (event, updateInfo) => {
  const win = BrowserWindow.getFocusedWindow();
  const updateCacheDir = path.join(app.getPath('userData'), 'update-cache');
  fs.mkdirSync(updateCacheDir, { recursive: true });

  const tempAsarPath = path.join(updateCacheDir, 'app.asar.new');
  const targetAsarPath = path.join(process.resourcesPath || '', 'app.asar');
  const asarUrl = (updateInfo && updateInfo.asarUrl) || `https://raw.githubusercontent.com/AdeeshaRavimal/koart/main/updates/app.asar`;
  const fallbackUrl = (updateInfo && updateInfo.fallbackAsarUrl) || `https://github.com/AdeeshaRavimal/koart/releases/download/v${updateInfo.newVersion}/app.asar`;

  const sendProgress = (pct) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-download-progress', pct);
    }
  };

  try {
    sendProgress(5);
    try {
      await downloadFileWithProgress(asarUrl, tempAsarPath, sendProgress);
    } catch (primaryErr) {
      console.warn('Primary update URL failed, switching to cloud fallback:', primaryErr.message);
      await downloadFileWithProgress(fallbackUrl, tempAsarPath, sendProgress);
    }

    sendProgress(100);

    // Save persistent engine copy in userData (survives portable EXE temp extracts)
    const engineDir = path.join(app.getPath('userData'), 'engine');
    fs.mkdirSync(engineDir, { recursive: true });
    try {
      fs.copyFileSync(tempAsarPath, path.join(engineDir, 'app.asar'));
    } catch (e) {}

    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

    // Portable EXE mode: native relaunch of the portable binary
    if (process.env.PORTABLE_EXECUTABLE_FILE) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-download-ready', { message: 'Update applied! Restarting...' });
      }
      app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE });
      setTimeout(() => {
        app.exit(0);
      }, 500);
      return { success: true };
    }

    // Development mode simulation
    if (!app.isPackaged || !fs.existsSync(targetAsarPath)) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-download-ready', { message: 'Development environment verified. Updates applied.' });
      }
      return { success: true, simulated: true };
    }

    // Unpacked directory mode: Hot Swap via detached helper script (avoids Windows file lock)
    const updaterBat = path.join(updateCacheDir, 'apply-update.bat');

    const batContent = [
      '@echo off',
      'timeout /t 1 /nobreak >nul',
      'set count=0',
      ':loop',
      `copy /y "${tempAsarPath}" "${targetAsarPath}" >nul 2>&1`,
      'if errorlevel 1 (',
      '  set /a count+=1',
      '  if %count% lss 6 (',
      '    timeout /t 1 /nobreak >nul',
      '    goto loop',
      '  )',
      ')',
      `del "${tempAsarPath}" >nul 2>&1`,
      `start "" "${exePath}"`,
      'del "%~f0" >nul 2>&1'
    ].join('\r\n');

    fs.writeFileSync(updaterBat, batContent, 'utf8');

    spawn('cmd.exe', ['/c', updaterBat], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();

    setTimeout(() => {
      app.exit(0);
    }, 500);

    return { success: true };
  } catch (err) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-download-error', err.message);
    }
    return { success: false, error: err.message };
  }
});

function checkForRemoteUpdates(win) {
  setTimeout(async () => {
    try {
      const currentVer = getActiveVersion();
      const remote = await fetchRemotePackage();
      if (remote && remote.version && isNewerVersion(remote.version, currentVer)) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('update-available-alert', {
            currentVersion: currentVer,
            newVersion: remote.version,
            releaseNotes: remote.description || 'General performance, reliability, and security updates.',
            asarUrl: `https://raw.githubusercontent.com/AdeeshaRavimal/koart/main/updates/app.asar`,
            fallbackAsarUrl: `https://github.com/AdeeshaRavimal/koart/releases/download/v${remote.version}/app.asar`
          });
        }
      }
    } catch (e) {}
  }, 3500);
}

function checkTrial(dataDir) {
  const licFile = path.join(dataDir, '.trial');
  let start;
  try {
    start = parseInt(Buffer.from(fs.readFileSync(licFile, 'utf8'), 'base64').toString('utf8'), 10);
    if (!start) throw new Error('bad');
  } catch (e) {
    start = Date.now();
    fs.writeFileSync(licFile, Buffer.from(String(start)).toString('base64'));
  }
  const used = (Date.now() - start) / 86400000;
  if (used > TRIAL_DAYS || start > Date.now() + 86400000) return -1;
  return Math.ceil(TRIAL_DAYS - used);
}

function startApp() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const daysLeft = checkTrial(dataDir);
  if (daysLeft < 0) {
    dialog.showErrorBox('KOart trial expired', `The ${TRIAL_DAYS}-day trial has ended. Please contact KOart for a full license.`);
    app.quit();
    return;
  }

  process.env.DATA_DIR = dataDir;
  process.env.NODE_ENV = 'production';

  const engineAsar = path.join(app.getPath('userData'), 'engine', 'app.asar');
  let createServer;
  if (fs.existsSync(engineAsar)) {
    try {
      createServer = require(path.join(engineAsar, 'server.js')).createServer;
    } catch (e) {
      createServer = require('../server').createServer;
    }
  } else {
    createServer = require('../server').createServer;
  }

  const server = createServer(38417); // fixed port keeps the browser login session between launches
  server.on('listening', () => {
    const port = server.address().port;
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      title: `KOart Platform v${getActiveVersion()} — Trial: ${daysLeft} day(s) left`,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    Menu.setApplicationMenu(null);
    win.on('page-title-updated', (e) => e.preventDefault());
    win.loadURL(`http://127.0.0.1:${port}`);
    win.webContents.on('did-finish-load', () => {
      checkForRemoteUpdates(win);
    });
  });
  app.on('before-quit', () => { try { server.close(); } catch (e) {} });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(startApp);
  app.on('window-all-closed', () => app.quit());
}
