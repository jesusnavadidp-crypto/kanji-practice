#!/usr/bin/env node
// One-time data prep: turns KanjiVG's combined dump (raw/kanjivg.xml) into
// data/strokes.js — just the ordered stroke path `d` strings per character,
// filtered to characters this app can actually display. Bundled rather than
// fetched at runtime: it's a one-time ~6,700-request-equivalent parse done
// once here, instead of once per user per character.

'use strict';

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'raw');
const DATA_DIR = path.join(__dirname, '..', 'data');

global.window = {};
eval(fs.readFileSync(path.join(DATA_DIR, 'radicals.js'), 'utf8'));
eval(fs.readFileSync(path.join(DATA_DIR, 'kanji.js'), 'utf8'));
const ourChars = new Set([
  ...window.RADICALS_DATA.map((r) => r.char),
  ...window.KANJI_DATA.map((k) => k.char),
]);

const xml = fs.readFileSync(path.join(RAW_DIR, 'kanjivg.xml'), 'utf8');

const strokesByChar = {};

for (const block of xml.split('<kanji id="kvg:kanji_').slice(1)) {
  const hex = block.match(/^([0-9a-fA-F]+)"/)?.[1];
  if (!hex) continue;

  const char = String.fromCodePoint(parseInt(hex, 16));
  if (!ourChars.has(char)) continue;

  const paths = [...block.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)].map((m) => m[1]);
  if (paths.length > 0) strokesByChar[char] = paths;
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(DATA_DIR, 'strokes.js'),
  `window.STROKES_DATA = ${JSON.stringify(strokesByChar)};\n`
);

console.log(`stroke diagrams: ${Object.keys(strokesByChar).length} / ${ourChars.size} characters`);
