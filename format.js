export function timestamp(seconds, separator = ',') {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
}
export function formatTranscript(segments, format) {
  if (format === 'json') return JSON.stringify(segments, null, 2) + '\n';
  if (format === 'txt') return segments.map(s => s.text).join('\n') + '\n';
  const vtt = format === 'vtt';
  const cues = segments.map((s, i) => {
    const end = s.duration > 0 ? s.start + s.duration : (segments[i + 1]?.start ?? s.start + 2);
    const text = s.text.replace(/\r/g, '').replace(/\n\s*\n/g, '\n');
    return `${i + 1}\n${timestamp(s.start, vtt ? '.' : ',')} --> ${timestamp(end, vtt ? '.' : ',')}\n${vtt ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : text}\n`;
  }).join('\n');
  return (vtt ? 'WEBVTT\n\n' : '') + cues;
}
export function filename(title, id, language, format) {
  // Filesystems limit filename bytes, not JS characters. Leave room for suffixes.
  const cleaned = String(title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  let safe = '', bytes = 0;
  for (const character of cleaned) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 160) break;
    safe += character;
    bytes += size;
  }
  safe = safe.replace(/^[. ]+|[. ]+$/g, '') || 'transcript';
  const safeId = String(id).replace(/[^\w-]/g, '_').slice(0, 11);
  const safeLanguage = String(language).replace(/[^\w-]/g, '_').slice(0, 24);
  return `${safe} [${safeId}].${safeLanguage}.${format}`;
}
