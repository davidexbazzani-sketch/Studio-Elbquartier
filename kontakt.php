<?php
/**
 * Kontaktformular – Mailversand für netcup Webhosting (PHP mail()).
 * Keine Datenbank, keine Cookies, keine Weitergabe an Dritte.
 */

declare(strict_types=1);

// ---- Einstellungen ---------------------------------------------------------
const EMPFAENGER = 'hallo@studio-elbquartier.de';  // hier kommen die Anfragen an
const ABSENDER   = 'hallo@studio-elbquartier.de';  // muss ein Postfach der eigenen Domain sein (netcup); Antworten gehen per Reply-To an die Kundschaft
const BETREFF    = 'Neue Anfrage über studio-elbquartier.de';
const MIN_SEKUNDEN = 3; // Formulare, die schneller abgeschickt werden, sind fast immer Spam
// -------------------------------------------------------------------------

// Läuft ab PHP 7.4 (netcup stellt neue Domains teils noch auf 7.4 ein); daher kein str_contains und kein „never“
$wantsJson = strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function antwort(bool $ok, string $message, int $code = 200): void
{
    global $wantsJson;
    http_response_code($code);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: index.html?' . ($ok ? 'gesendet=1' : 'fehler=1') . '#kontakt', true, 303);
    }
    exit;
}

function feld(string $name, int $max): string
{
    $v = trim((string)($_POST[$name] ?? ''));
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    return mb_substr($v, 0, $max);
}

function einzeilig(string $v): string
{
    return trim(preg_replace('/[\r\n\t]+/', ' ', $v) ?? '');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(false, 'Ungültige Anfrage.', 405);
}

// Spam-Schutz: Honeypot und Zeitfalle. Bots bekommen eine scheinbare Erfolgsmeldung.
// Den Zeitstempel setzt das Skript der Seite beim Laden; fehlt er, kam die Anfrage nicht über das Formular.
$ts = (int)($_POST['ts'] ?? 0);
$alter = time() - $ts;
if (!empty($_POST['website']) || ($ts > 0 && $alter < MIN_SEKUNDEN)) {
    antwort(true, 'Danke!');
}
if ($ts <= 0) {
    antwort(false, 'Bitte aktivieren Sie JavaScript oder schreiben Sie uns direkt an ' . EMPFAENGER . '.', 422);
}
if ($alter > 2 * 86400) {
    antwort(false, 'Die Seite war sehr lange geöffnet. Bitte laden Sie sie neu und senden Sie die Nachricht noch einmal.', 422);
}

$name      = einzeilig(feld('name', 120));
$laden     = einzeilig(feld('laden', 120));
$email     = einzeilig(feld('email', 160));
$telefon   = einzeilig(feld('telefon', 40));
$paket     = einzeilig(feld('paket', 20));
$gespraech = einzeilig(feld('gespraech', 20));
$nachricht = feld('nachricht', 4000);
$einwilligung = ($_POST['einwilligung'] ?? '') === 'ja';

if ($name === '' || $nachricht === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$einwilligung) {
    antwort(false, 'Bitte prüfen Sie Ihre Angaben.', 422);
}
$interesse = [
    'Starter'  => 'Website Starter',
    'Pro'      => 'Website Pro',
    'Max'      => 'Website Max',
    'Software' => 'Softwarelösung',
][$paket] ?? 'noch offen';
if (!in_array($gespraech, ['', 'vor Ort', 'Telefon'], true)) {
    $gespraech = '';
}

$text = "Neue Anfrage über die Website\n"
      . "--------------------------------\n"
      . "Name:     {$name}\n"
      . "Laden/Firma: " . ($laden ?: '–') . "\n"
      . "E-Mail:   {$email}\n"
      . "Telefon:  " . ($telefon ?: '–') . "\n"
      . "Interesse: {$interesse}\n"
      . "Gespräch: " . ($gespraech ?: 'wie es am besten passt') . "\n"
      . "--------------------------------\n\n"
      . $nachricht . "\n\n"
      . "Datenschutzhinweis bestätigt: ja (" . date('d.m.Y H:i') . ")\n";

$headers = [
    'From' => 'Studio Elbquartier Website <' . ABSENDER . '>',
    'Reply-To' => $email,
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'X-Mailer' => 'PHP',
];

$betreff = '=?UTF-8?B?' . base64_encode(BETREFF . ($laden ? " – {$laden}" : '')) . '?=';
$ok = mail(EMPFAENGER, $betreff, $text, $headers, '-f' . ABSENDER);

$ok
    ? antwort(true, 'Danke! Ihre Nachricht ist angekommen.')
    : antwort(false, 'Die Nachricht konnte gerade nicht gesendet werden.', 500);
