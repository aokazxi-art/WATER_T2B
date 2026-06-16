export function exportDailyCsv(pondName, dateLabel, rows, area) {
  const header = 'Time,Distance/Level,Water_Depth,Volume,Battery';

  const lines = rows.map(entry => {
    const d    = new Date(entry.time);
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    const time = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

    const distCol = (entry.dist / 100).toFixed(3) + ' m';
    const whCol   = (entry.wh   / 100).toFixed(3) + ' m';

    let volumeCol;
    if (entry.volume != null) {
      volumeCol = entry.volume;
    } else if (area != null && entry.wh != null) {
      volumeCol = (area * entry.wh / 1_000_000).toFixed(1);
    } else {
      volumeCol = '-';
    }

    const batteryCol = entry.battery != null ? entry.battery + ' %' : '-';

    return `${time},${distCol},${whCol},${volumeCol},${batteryCol}`;
  });

  const csv  = '﻿' + [header, ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${pondName}_${dateLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
