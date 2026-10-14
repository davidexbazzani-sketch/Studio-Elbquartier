#!/bin/zsh
# Rendert Showroom-Standbilder mit Chrome im Hintergrund (Dev-Server muss laufen), Ergebnis in assets/img/autohaus-test/.
# Aufruf: tools/autohaus-shots.sh "shots=porsche,ferrari,g63&views=schraeg,heck&tag=v1"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/img/autohaus-test"
mkdir -p "$DIR"; rm -f "$DIR/zz-fertig.png"
PROFIL=$(mktemp -d)
"$CHROME" --headless=new --no-first-run --no-default-browser-check --disable-background-networking --disable-component-update \
  --enable-gpu --use-angle=metal --ignore-gpu-blocklist --window-size=1440,900 \
  --user-data-dir="$PROFIL" "http://localhost:8765/tools/autohaus-showroom.html?$1" >/dev/null 2>&1 &
PID=$!
for i in {1..180}; do sleep 1; [ -f "$DIR/zz-fertig.png" ] && break; done
kill $PID 2>/dev/null; sleep 1; kill -9 $PID 2>/dev/null
rm -rf "$PROFIL"
[ -f "$DIR/zz-fertig.png" ] && { rm -f "$DIR/zz-fertig.png"; echo "fertig nach ${i}s"; } || echo "Zeitüberschreitung"
