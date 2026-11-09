/**
 * KOart Desktop (Electron) — wraps the platform server in a native window.
 * Data is stored in the user's app-data folder; 7-day trial starts on first run.
 */
const { app, BrowserWindow, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
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

function checkForRemoteUpdates(win) {
  try {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: '/AdeeshaRavimal/koart/main/package.json',
      headers: { 'User-Agent': 'KOart-Desktop-App' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const remotePkg = JSON.parse(data);
          if (remotePkg && remotePkg.version && isNewerVersion(remotePkg.version, pkg.version)) {
            win.webContents.executeJavaScript(`
              setTimeout(() => {
                if (typeof showToast === 'function') {
                  showToast('🚀 Version v${remotePkg.version} is available on GitHub! Update ready.');
                }
              }, 3000);
            `);
          }
        } catch (e) {}
      });
    }).on('error', () => {});
  } catch (e) {}
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

  const { createServer } = require('../server');
  const server = createServer(38417); // fixed port keeps the browser login session between launches
  server.on('listening', () => {
    const port = server.address().port;
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      title: `KOart Platform v${pkg.version || '1.1.0'} — Trial: ${daysLeft} day(s) left`,
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
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
