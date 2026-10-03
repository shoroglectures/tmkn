export function fmtDate(ts) {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';

  const gregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

  return `${gregorian} م · ${hijri}`;
}

export function fmtPct(n) {
  return `${Math.round(Number(n) || 0)}%`;
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
}