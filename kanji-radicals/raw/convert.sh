#!/usr/bin/env bash
# Re-fetches all source data this app is built from and converts it into the
# plain-text/sqlite/XML inputs the scripts/build-*.js scripts parse:
#   - EDRDG KRADFILE/RADKFILE (radical/kanji decomposition), EUC-JP -> UTF-8
#   - EDRDG KANJIDIC2 (on'yomi/kun'yomi/meanings), gzipped XML
#   - Jonathan Waller's JLPT kanji lists (tanos.co.uk), Anki 1.x sqlite files
#   - KanjiVG's combined stroke-data dump (one release asset, not one request
#     per character — bump the release tag below if a newer one exists)
set -euo pipefail
cd "$(dirname "$0")"

curl -sSL -o kradfile.gz http://ftp.edrdg.org/pub/Nihongo/kradfile.gz
curl -sSL -o radkfile.gz http://ftp.edrdg.org/pub/Nihongo/radkfile.gz
curl -sSL -o kradzip.zip http://ftp.edrdg.org/pub/Nihongo/kradzip.zip
gunzip -kf kradfile.gz
gunzip -kf radkfile.gz
unzip -o kradzip.zip kradfile2 radkfile2

for f in kradfile kradfile2 radkfile radkfile2; do
  iconv -f EUC-JP -t UTF-8 "$f" > "${f}.utf8.txt"
done

curl -sSL -o kanjidic2.xml.gz http://www.edrdg.org/kanjidic/kanjidic2.xml.gz
gunzip -kf kanjidic2.xml.gz

mkdir -p jlpt
for n in 1 2 3 4 5; do
  curl -sSL -o "jlpt/n${n}.anki" "http://www.tanos.co.uk/jlpt/jlpt${n}/kanji/n${n}-kanji-char-eng.anki"
done

KANJIVG_RELEASE="r20250816"
curl -sSL -o kanjivg.xml.gz "https://github.com/KanjiVG/kanjivg/releases/download/${KANJIVG_RELEASE}/kanjivg-${KANJIVG_RELEASE#r}.xml.gz"
gunzip -kf kanjivg.xml.gz

echo "Converted: kradfile.utf8.txt kradfile2.utf8.txt radkfile.utf8.txt radkfile2.utf8.txt kanjidic2.xml jlpt/n1..5.anki kanjivg.xml"
