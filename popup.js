import { readCaptions } from './captions.js';
import { formatTranscript, filename } from './format.js';
import { followSystemTheme } from './theme.js';
followSystemTheme();
const $ = id => document.getElementById(id);
let tabId, metadata;
async function read(index = null) {
  const [injection] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: readCaptions, args: [index, metadata?.id || null] });
  if (!injection?.result) throw new Error('Cannot read this tab. Open a YouTube video.');
  if (injection.result.error) throw new Error(injection.result.error);
  return injection.result;
}
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab.id;
    if (!/^https:\/\/(www\.|m\.)?youtube\.com\//.test(tab.url || '')) throw new Error('Open a YouTube video, then click this extension.');
    metadata = await read();
    $('video').textContent = metadata.title;
    metadata.tracks.forEach((track, i) => $('language').add(new Option(track.name, i)));
    $('language').disabled = false;
    $('download').disabled = false;
    $('status').textContent = 'Ready to download.';
  } catch (error) { $('video').textContent = 'No captions loaded'; $('status').textContent = error.message; }
}
$('download').addEventListener('click', async () => {
  $('download').disabled = true;
  $('status').textContent = 'Fetching captions… Keep this popup open.';
  let objectUrl;
  try {
    const data = await read(Number($('language').value));
    const format = $('format').value;
    objectUrl = URL.createObjectURL(new Blob([formatTranscript(data.segments, format)], { type: 'text/plain;charset=utf-8' }));
    await chrome.downloads.download({ url: objectUrl, filename: filename(data.title, data.id, data.language, format), saveAs: true, conflictAction: 'uniquify' });
    $('status').textContent = 'Download started.';
  } catch (error) { $('status').textContent = error.message; }
  finally {
    $('download').disabled = false;
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
});
init();
