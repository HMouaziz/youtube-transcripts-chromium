// Runs only after the user opens the extension, in the current YouTube tab.
export async function readCaptions(trackIndex = null, expectedVideo = null) {
  try {
    const url = new URL(location.href);
    const id = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/)?.[1];
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) || !id)
      throw new Error('Open a YouTube video, then click this extension.');
    if (expectedVideo && expectedVideo !== id) throw new Error('The video changed. Close and reopen the extension.');
    const player = document.getElementById('movie_player');
    const response = player?.getPlayerResponse?.() || window.ytInitialPlayerResponse;
    if (response?.videoDetails?.videoId !== id)
      throw new Error('The video is still loading. Play it briefly, then reopen the extension.');
    const tracks = response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const metadata = {
      id, title: response.videoDetails.title || id,
      tracks: tracks.map(t => ({ name: (t.name?.simpleText || t.name?.runs?.map(r => r.text).join('') || t.languageCode) + (t.kind === 'asr' ? ' (automatic)' : ''), language: t.languageCode }))
    };
    if (trackIndex === null) {
      if (!tracks.length) throw new Error('No captions are available for this video.');
      return metadata;
    }
    const track = tracks[trackIndex];
    if (!track) throw new Error('Caption selection changed. Reopen the extension.');
    async function fetchTrack(selected, credentials) {
      const captionUrl = new URL(selected.baseUrl);
      if (captionUrl.protocol !== 'https:' || !['www.youtube.com', 'youtube.com'].includes(captionUrl.hostname) || captionUrl.pathname !== '/api/timedtext')
        throw new Error('YouTube returned an unsupported caption URL.');
      captionUrl.searchParams.set('fmt', 'json3');
      const result = await fetch(captionUrl.href, { credentials, signal: AbortSignal.timeout(15000) });
      if (!result.ok) throw new Error(`YouTube returned HTTP ${result.status}.`);
      const body = await result.text();
      if (!body.trim()) return [];
      const data = JSON.parse(body);
      return (data.events || []).filter(e => e.segs).map(e => ({
        text: e.segs.map(s => s.utf8 || '').join('').trim(),
        start: Number(e.tStartMs || 0) / 1000, duration: Number(e.dDurationMs || 0) / 1000
      })).filter(s => s.text && Number.isFinite(s.start) && Number.isFinite(s.duration));
    }
    let segments = await fetchTrack(track, 'include');
    if (!segments.length) {
      // The web player sometimes supplies caption URLs that return an empty body.
      // Ask YouTube's public mobile player for the same language/type once.
      const alternate = await fetch('/youtubei/v1/player', {
        method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } }, videoId: id })
      });
      if (!alternate.ok) throw new Error(`YouTube returned HTTP ${alternate.status}.`);
      const alternateData = await alternate.json();
      const matching = alternateData.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(
        t => t.languageCode === track.languageCode && (t.kind || '') === (track.kind || '')
      );
      if (matching) segments = await fetchTrack(matching, 'omit');
    }
    if (!segments.length) {
      throw new Error('YouTube did not return caption text. Try playing the video with captions enabled, then reopen this extension. This video may block caption downloads.');
    }
    return { ...metadata, language: track.languageCode, segments };
  } catch (error) { return { error: error.message || String(error) }; }
}
