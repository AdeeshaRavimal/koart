/**
 * KOart Desktop (Electron) — wraps the platform server in a native window.
 * Data is stored in the user's app-data folder; 7-day trial starts on first run.
 */
const { app, BrowserWindow, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

const TRIAL_DAYS = 7;

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
      title: `KOart Platform — Trial: ${daysLeft} day(s) left`,
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    Menu.setApplicationMenu(null);
    win.on('page-title-updated', (e) => e.preventDefault());
    win.loadURL(`http://127.0.0.1:${port}`);
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
