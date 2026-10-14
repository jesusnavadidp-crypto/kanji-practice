#!/usr/bin/env node
// One-time data prep: turns EDRDG's KANJIDIC2 (raw/kanjidic2.xml) into
// data/kanjidic.js — on'yomi, kun'yomi, English meanings and the Heisig RTK
// (6th edition) frame number per character.
// Regex-parsed rather than pulling in an XML library: KANJIDIC2's per-character
// blocks are simple and regular enough not to need one.

'use strict';

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'raw');
const DATA_DIR = path.join(__dirname, '..', 'data');

const xml = fs.readFileSync(path.join(RAW_DIR, 'kanjidic2.xml'), 'utf8');

const extractAll = (block, tagPattern) => [...block.matchAll(tagPattern)].map((m) => m[1]);

const kanjidicByChar = {};

for (const block of xml.split('<character>').slice(1)) {
  const literal = block.match(/<literal>(.+?)<\/literal>/)?.[1];
  if (!literal) continue;

  const on = extractAll(block, /<reading r_type="ja_on">(.+?)<\/reading>/g);
  const kun = extractAll(block, /<reading r_type="ja_kun">(.+?)<\/reading>/g);
  // A plain <meaning> with no m_lang attribute is English; translated meanings
  // carry m_lang="fr"/"es"/"pt" and are out of scope for this app.
  const meanings = extractAll(block, /<meaning>(.+?)<\/meaning>/g);

  // RTK (Remembering the Kanji, 6th ed.) frame number; absent for kanji the
  // book doesn't cover, in which case the key is omitted from the entry.
  const rtk = Number.parseInt(block.match(/<dic_ref dr_type="heisig6">(\d+)<\/dic_ref>/)?.[1], 10);

  if (on.length === 0 && kun.length === 0 && meanings.length === 0) continue;
  kanjidicByChar[literal] = Number.isNaN(rtk) ? { on, kun, meanings } : { on, kun, meanings, rtk };
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(DATA_DIR, 'kanjidic.js'),
  `window.KANJIDIC_DATA = ${JSON.stringify(kanjidicByChar)};\n`
);

console.log(`kanjidic entries: ${Object.keys(kanjidicByChar).length}`);
