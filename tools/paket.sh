#!/bin/zsh
# Upload-Paket für netcup bauen: kopiert NUR die Dateien, die auf den Server gehören, nach ./Upload/
# (Inhalt dieses Ordners per FTP/Dateimanager ins Web-Verzeichnis der Domain laden).
# Aufruf: tools/paket.sh
set -e
cd "$(dirname "$0")/.."
ZIEL=Upload
mkdir -p "$ZIEL"
# --delete hält das Paket deckungsgleich mit dem Projekt
rsync -a --delete --delete-excluded \
  --exclude '.DS_Store' --exclude '.claude/' --exclude '.git/' --exclude '.gitignore' \
  --exclude 'tools/' --exclude 'Druckdaten/' --exclude 'Vorschau/' --exclude 'Upload/' \
  --exclude 'README.md' --exclude 'CREDITS.md' \
  --exclude 'assets/img/funkl-test/' --exclude 'assets/img/autohaus-test/' \
  --exclude 'beispiele/autohaus/' --exclude 'assets/img/autohaus/' --exclude 'assets/models/autos/' --exclude 'assets/video/autohaus/' \
  ./ "$ZIEL/"
# Kontrolle: nichts davon darf im Paket sein
for x in tools Druckdaten Vorschau README.md CREDITS.md .gitignore .git beispiele/autohaus assets/models/autos assets/img/funkl-test; do
  if [ -e "$ZIEL/$x" ]; then echo "FEHLER: $x ist im Paket"; exit 1; fi
done
# Verweise der Seiten auf ausgeschlossene Dateien finden
grep -rlE "autohaus/|funkl-test|elbe-morgen|elbe-abend|CREDITS\.md" "$ZIEL" --include='*.html' --include='*.css' | sed 's/^/Hinweis: Verweis in /' || true
echo "Paket fertig: $(du -sh "$ZIEL" | cut -f1), $(find "$ZIEL" -type f | wc -l | tr -d ' ') Dateien in $ZIEL/"
