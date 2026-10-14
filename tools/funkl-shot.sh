#!/bin/zsh
# Rendert eine FUNKL-Testseite mit Chrome im Hintergrund. Aufruf: tools/funkl-shot.sh "funkl-dose.html?f=mango&t=8&shot=a"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/img/funkl-test"
mkdir -p "$DIR"; rm -f "$DIR/zz-fertig.png"
PROFIL=$(mktemp -d)
"$CHROME" --headless=new --no-first-run --no-default-browser-check --disable-background-networking --disable-component-update \
  --enable-gpu --use-angle=metal --ignore-gpu-blocklist --window-size=${W:-1200},${H:-900} \
  --user-data-dir="$PROFIL" "http://localhost:8765/tools/$1" >/dev/null 2>&1 &
PID=$!
for i in {1..120}; do sleep 1; [ -f "$DIR/zz-fertig.png" ] && break; done
kill $PID 2>/dev/null; sleep 1; kill -9 $PID 2>/dev/null
rm -rf "$PROFIL"
[ -f "$DIR/zz-fertig.png" ] && { rm -f "$DIR/zz-fertig.png"; echo "fertig nach ${i}s"; } || echo "Zeitüberschreitung"
