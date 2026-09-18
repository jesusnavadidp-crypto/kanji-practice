#!/usr/bin/env node
// One-time data prep: turns Jonathan Waller's JLPT kanji lists (the same
// source jisho.org itself credits for its JLPT tags) into data/jlpt.js.
// The source files are old Anki 1.x decks, which are just sqlite databases —
// read via the `sqlite3` CLI rather than pulling in a database dependency.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAW_DIR = path.join(__dirname, '..', 'raw', 'jlpt');
const DATA_DIR = path.join(__dirname, '..', 'data');

const kanjiForLevel = (level) => {
  const dbFile = path.join(RAW_DIR, `n${level}.anki`);
  const query =
    "select value from fields where fieldModelId = (select id from fieldModels where name = 'Front');";
  const output = execFileSync('sqlite3', [dbFile, query], { encoding: 'utf8' });
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
};

const jlptByChar = {};
// N5 (easiest) first, so a character already assigned an easier level keeps it
// in the rare case a kanji shows up in more than one of Waller's level lists.
for (const level of [5, 4, 3, 2, 1]) {
  for (const char of kanjiForLevel(level)) {
    if (!(char in jlptByChar)) jlptByChar[char] = level;
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'jlpt.js'), `window.JLPT_DATA = ${JSON.stringify(jlptByChar)};\n`);

console.log(`jlpt-tagged kanji: ${Object.keys(jlptByChar).length}`);
