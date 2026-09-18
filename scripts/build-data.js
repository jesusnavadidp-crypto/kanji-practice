#!/usr/bin/env node
// One-time data prep: turns the raw EDRDG KRADFILE/RADKFILE (converted to UTF-8 text
// by raw/convert.sh) into data/radicals.js and data/kanji.js.
// Re-run this only if the source files in raw/ change.

'use strict';

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'raw');
const DATA_DIR = path.join(__dirname, '..', 'data');

const readLines = (file) =>
  fs
    .readFileSync(path.join(RAW_DIR, file), 'utf8')
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('#'));

// KRADFILE(2) line shape: "KANJI : COMPONENT COMPONENT ..."
const parseKradFile = (file, into) => {
  for (const line of readLines(file)) {
    const [kanjiPart, componentsPart] = line.split(':');
    const kanji = kanjiPart.trim();
    const components = componentsPart.trim().split(/\s+/);
    if (!kanji || components.length === 0) continue;
    into.set(kanji, components);
  }
};

// RADKFILE(2) line shape: a header "$ RADICAL STROKE_COUNT [code]" followed by
// one or more lines of kanji that contain that radical, packed with no separators.
const parseRadkFile = (file, into) => {
  let current = null;
  for (const line of readLines(file)) {
    if (line.startsWith('$')) {
      const [, radical, strokeCountText] = line.split(/\s+/);
      const strokeCount = Number(strokeCountText);
      current = into.get(radical);
      if (!current) {
        current = { char: radical, strokeCount, kanji: new Set() };
        into.set(radical, current);
      }
    } else if (current) {
      for (const char of line.trim()) current.kanji.add(char);
    }
  }
};

const kanjiComponents = new Map();
parseKradFile('kradfile.utf8.txt', kanjiComponents);
parseKradFile('kradfile2.utf8.txt', kanjiComponents);

const radicals = new Map();
parseRadkFile('radkfile.utf8.txt', radicals);
parseRadkFile('radkfile2.utf8.txt', radicals);

// A KRADFILE entry that only lists itself (e.g. "人 : 人") carries no real
// decomposition — treat it as having no sub-components.
const componentsOf = (char) => {
  const components = kanjiComponents.get(char);
  if (!components) return [];
  if (components.length === 1 && components[0] === char) return [];
  return components;
};

const radicalsOut = [...radicals.values()]
  .map((r) => ({
    char: r.char,
    strokeCount: r.strokeCount,
    components: componentsOf(r.char),
    kanjiUsing: [...r.kanji].sort(),
  }))
  .sort((a, b) => a.strokeCount - b.strokeCount || a.char.codePointAt(0) - b.char.codePointAt(0));

// Includes radicals that are themselves real, standalone kanji (anything with
// a genuine KRADFILE entry — a radical with no entry at all, like the pure
// stroke-shape "｜", isn't a real character and stays radical-only). These show
// up in both spaces: as a radical to decompose other kanji with, and as a
// kanji you can rank and use directly.
const kanjiOut = [...kanjiComponents.keys()]
  .map((char) => ({ char, components: componentsOf(char) }))
  .sort((a, b) => a.char.codePointAt(0) - b.char.codePointAt(0));

// Shipped as plain <script>-loaded globals rather than fetched JSON: fetching a
// local JSON file is blocked by CORS on file:// in most browsers, which would
// break the "just double-click index.html" portability this app is built for.
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(DATA_DIR, 'radicals.js'),
  `window.RADICALS_DATA = ${JSON.stringify(radicalsOut)};\n`
);
fs.writeFileSync(
  path.join(DATA_DIR, 'kanji.js'),
  `window.KANJI_DATA = ${JSON.stringify(kanjiOut)};\n`
);

console.log(`radicals: ${radicalsOut.length}, kanji: ${kanjiOut.length}`);
