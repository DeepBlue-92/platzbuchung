function parseToYYYYMMDD(val) {
  if (!val) return "";
  if (typeof val === 'string') {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
    // DD.MM.YYYY
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(val)) {
      const [d, m, y] = val.split('.');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Fallback: try standard Date
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return "";
  }
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return "";
}

console.log(parseToYYYYMMDD("1990-08-24"));
console.log(parseToYYYYMMDD("24.08.1990"));
console.log(parseToYYYYMMDD("01.05.2000"));
