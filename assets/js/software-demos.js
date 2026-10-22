/* Kleine Beispiel-Ansichten im Software-Bereich zum Ausprobieren: Tischreservierung und Schicht-Checkliste.
   Läuft auf der Startseite (über main.js) und auf der Software-Seite (eigenes Skript-Tag). */
(() => {
  const booking = document.querySelector('[data-demo="booking"]');
  if (booking && !booking.dataset.ready) {
    booking.dataset.ready = '1';
    const dates = booking.querySelector('[data-dates]');
    const times = booking.querySelector('[data-times]');
    const out = booking.querySelector('[data-persons]');
    const summary = booking.querySelector('[data-summary]');
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    // ohne toLocaleDateString: das erste Laden der Sprachdaten blockiert den Browser spürbar
    const longDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const pad = (n) => String(n).padStart(2, '0');
    // Die nächsten vier Tage ab morgen, damit das Beispiel immer aktuell aussieht
    const first = new Date();
    first.setDate(first.getDate() + 1);
    [...dates.querySelectorAll('button')].forEach((b, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      b.dataset.label = `${days[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
      b.innerHTML = `<small>${days[d.getDay()]}</small>${d.getDate()}`;
      b.setAttribute('aria-label', `${longDays[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`);
    });
    let persons = 4;
    const pick = (group, btn) => group.querySelectorAll('button').forEach((b) => { if (!b.disabled) b.setAttribute('aria-pressed', String(b === btn)); });
    const update = () => {
      const d = dates.querySelector('[aria-pressed="true"]');
      const t = times.querySelector('[aria-pressed="true"]');
      out.textContent = persons;
      summary.textContent = `${d.dataset.label} · ${t.textContent} · ${persons} ${persons === 1 ? 'Person' : 'Personen'}`;
    };
    dates.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { pick(dates, b); update(); } });
    times.addEventListener('click', (e) => { const b = e.target.closest('button:not(:disabled)'); if (b) { pick(times, b); update(); } });
    booking.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      persons = Math.min(12, Math.max(1, persons + Number(b.dataset.step)));
      update();
    }));
    update();
  }

  document.querySelectorAll('[data-demo="checklist"]').forEach((list) => {
    const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
    const count = list.querySelector('[data-count]');
    const meter = list.querySelector('[data-meter]');
    const update = () => {
      const n = boxes.filter((b) => b.checked).length;
      count.textContent = `${n}/${boxes.length}`;
      meter.style.setProperty('--p', n / boxes.length);
    };
    boxes.forEach((b) => b.addEventListener('change', update));
    update();
  });
})();
