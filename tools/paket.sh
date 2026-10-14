#!/bin/zsh
# Upload-Paket für netcup bauen: kopiert NUR die Dateien, die auf den Server gehören, nach ./Upload/
# (Inhalt dieses Ordners per FTP/Dateimanager ins Web-Verzeichnis der Domain laden).
# Aufruf: tools/paket.sh
set -e
cd "$(dirname "$0")/.."
ZIEL=Upload
mkdir -p "$ZIEL"
# --delete hält das Paket deckungsgleich mit dem Projekt; .git (GitHub-Repository) und README.md des Pakets bleiben
rsync -a --delete --exclude '/.git/' --exclude '/README.md' \
  --exclude '.DS_Store' --exclude '.claude/' --exclude '.git/' \
  --exclude 'tools/' --exclude 'Druckdaten/' --exclude 'Vorschau/' --exclude 'Upload/' \
  --exclude 'README.md' --exclude 'CREDITS.md' \
  --exclude 'assets/img/funkl-test/' --exclude 'assets/img/autohaus-test/' \
  --exclude 'beispiele/autohaus/' --exclude 'assets/img/autohaus/' --exclude 'assets/models/autos/' --exclude 'assets/video/autohaus/' \
  ./ "$ZIEL/"
cp tools/paket-readme.md "$ZIEL/README.md"
# Kontrolle: nichts davon darf im Paket sein
for x in tools Druckdaten Vorschau CREDITS.md beispiele/autohaus assets/models/autos assets/img/funkl-test; do
  if [ -e "$ZIEL/$x" ]; then echo "FEHLER: $x ist im Paket"; exit 1; fi
done
# Verweise der Seiten auf ausgeschlossene Dateien finden
grep -rlE "autohaus/|funkl-test|elbe-morgen|elbe-abend|CREDITS\.md" "$ZIEL" --include='*.html' --include='*.css' | sed 's/^/Hinweis: Verweis in /' || true
echo "Paket fertig: $(du -sh "$ZIEL" | cut -f1), $(find "$ZIEL" -type f | wc -l | tr -d ' ') Dateien in $ZIEL/"
