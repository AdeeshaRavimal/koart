/**
 * Desktop launcher for the packaged .exe
 * - Stores data next to the .exe (./data)
 * - 7-day trial (starts on first run)
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const TRIAL_DAYS = 7;
const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const dataDir = path.join(baseDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// ---- Trial check ----
const licFile = path.join(dataDir, '.trial');
let start = Date.now();
try {
  start = parseInt(Buffer.from(fs.readFileSync(licFile, 'utf8'), 'base64').toString('utf8'), 10);
  if (!start) throw new Error('bad');
} catch (e) {
  start = Date.now();
  fs.writeFileSync(licFile, Buffer.from(String(start)).toString('base64'));
}
const daysUsed = (Date.now() - start) / 86400000;
if (daysUsed > TRIAL_DAYS || start > Date.now() + 86400000) {
  console.log('================================================');
  console.log(`  KOart trial expired (${TRIAL_DAYS} days). Contact KOart for a full license.`);
  console.log('================================================');
  setTimeout(() => process.exit(1), 15000);
} else {
  const left = Math.ceil(TRIAL_DAYS - daysUsed);
  console.log(`KOart trial: ${left} day(s) remaining.`);
  const { createServer } = require('./server');
  const port = parseInt(process.env.PORT, 10) || 3000;
  createServer(port);
  setTimeout(() => exec(`start http://localhost:${port}`), 1500);
}

