#!/usr/bin/env node
// Prints the CHANGELOG.md section for one version, for the GitHub Release.
//   node tools/release-notes.js 0.1.0
'use strict';

const fs = require('fs');
const path = require('path');

function notes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.replace(/[[\]]/g, '').split(' ')[1] === version && l.startsWith('## '));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

if (require.main === module) {
  const version = process.argv[2];
  const text = notes(fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8'), version || '');
  if (!text) { console.error(`CHANGELOG.md has no section for ${version}.`); process.exit(1); }
  process.stdout.write(text + '\n');
}

module.exports = { notes };
