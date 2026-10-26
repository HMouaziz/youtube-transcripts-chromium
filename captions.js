// Self-contained: injected in MAIN for metadata, ISOLATED for fetch/progress.
export async function readCaptions(trackIndex = null, expectedVideo = null, options = {}) {
  let controller, timeout;
  const requestId = options.requestId;
  const fail = (code, message, retryable = false) => Object.assign(new Error(message), {code, retryable});
  let id;
  let phase = '';
  let lastSent = 0;
  let hadPreview = false;
  function report(update) {
    if (!requestId || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const now = Date.now();
    if (update.phase === phase && now - lastSent < 100 && (hadPreview || !update.preview?.length)) return;
    phase = update.phase; lastSent = now; hadPreview ||= !!update.preview?.length;
    chrome.runtime.sendMessage({type:'transcript-progress', requestId, videoId:id, ...update}).catch(() => {});
  }
  try {
    const url = new URL(location.href);
    id = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/)?.[1];
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) || !id)
      throw fail('NOT_VIDEO', 'Open a YouTube video, then click this extension.');
    if (expectedVideo && expectedVideo !== id) throw fail('VIDEO_CHANGED', 'The video changed. Reload the video details.', true);
    let metadata = options.metadata;
    if (!metadata) {
      const player = document.getElementById('movie_player');
      const response = player?.getPlayerResponse?.() || globalThis.ytInitialPlayerResponse;
      const status = response?.playabilityStatus;
      if (status?.status && status.status !== 'OK')
        throw fail('ACCESS_RESTRICTED', typeof status.reason === 'string' ? status.reason : 'YouTube reports that this video is unavailable.');
      if (response?.videoDetails?.videoId !== id)
        throw fail('PLAYER_LOADING', 'The video is still loading. Play it briefly and retry.', true);
      const tracks = response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      metadata = {
        id, title: response.videoDetails.title || id,
        tracks: tracks.map(t => ({name:(t.name?.simpleText || t.name?.runs?.map(r => r.text).join('') || t.languageCode) + (t.kind === 'asr' ? ' (automatic)' : ''),
          language:t.languageCode, baseUrl:t.baseUrl, kind:t.kind || ''}))
      };
    }
    if (metadata.id !== id) throw fail('VIDEO_CHANGED', 'The video changed. Reload the video details.', true);
    if (trackIndex === null) {
      if (!metadata.tracks.length) throw fail('NO_CAPTIONS', 'No captions are available for this video. YouTube lists no caption tracks.');
      return metadata;
    }
    const track = metadata.tracks[trackIndex];
    if (!track) throw fail('TRACK_CHANGED', 'Caption selection changed. Reload the video details.', true);
    controller = new AbortController();
    if (requestId) {
      globalThis.__transcriptRequests ||= new Map();
      // Only one selected track is fetched per tab. A replaced popup cancels old work.
      for (const active of globalThis.__transcriptRequests.values()) active.abort();
      globalThis.__transcriptRequests.clear();
      globalThis.__transcriptRequests.set(requestId, controller);
    }
    timeout = setTimeout(() => controller.abort(new DOMException('Transcript request timed out.', 'TimeoutError')), 30000);
    async function request(address, settings) {
      let result;
      try { result = await fetch(address, {...settings, signal:controller.signal}); }
      catch (error) {
        if (controller.signal.aborted || ['AbortError','TimeoutError'].includes(error.name)) throw error;
        throw fail('NETWORK_ERROR', 'Could not connect to YouTube. Check your connection and retry.', true);
      }
      if (!result.ok) {
        if (result.status === 429) throw fail('RATE_LIMITED', 'YouTube returned HTTP 429: too many requests. Wait a while before retrying.', true);
        if ([401,403].includes(result.status)) throw fail('ACCESS_RESTRICTED', `YouTube returned HTTP ${result.status}: access to captions was refused.`);
        throw fail('SERVER_ERROR', `YouTube returned HTTP ${result.status}. Try again later.`, true);
      }
      return result;
    }
    function segment(event) {
      if (!Array.isArray(event.segs)) return null;
      const text = event.segs.map(s => typeof s.utf8 === 'string' ? s.utf8 : '').join('').trim();
      const start = Number(event.tStartMs || 0)/1000, duration = Number(event.dDurationMs || 0)/1000;
      return text && Number.isFinite(start) && Number.isFinite(duration) ? {text,start,duration} : null;
    }
    async function fetchTrack(selected, credentials) {
      const captionUrl = new URL(selected.baseUrl);
      if (captionUrl.protocol !== 'https:' || !['www.youtube.com','youtube.com'].includes(captionUrl.hostname) || captionUrl.pathname !== '/api/timedtext')
        throw fail('UNSUPPORTED_RESPONSE', 'YouTube returned an unsupported caption URL.');
      captionUrl.searchParams.set('fmt','json3');
      report({phase:'connecting',bytes:0,preview:[]});
      const result = await request(captionUrl.href, {credentials});
      let body = '', bytes = 0, cursor = 0, eventStart = -1, depth = 0, quoted = false, escaped = false, eventsFound = false, eventsEnded = false;
      let count = 0; const preview = [];
      function partial() {
        if (eventsEnded) return;
        if (!eventsFound) {
          const match = /"events"\s*:\s*\[/.exec(body);
          if (!match) return;
          cursor = match.index + match[0].length; eventsFound = true;
        }
        // Process only complete JSON event objects. Never parse a partial event.
        for (; cursor < body.length; cursor++) {
          const c = body[cursor];
          if (quoted) { if (escaped) escaped=false; else if (c === '\\') escaped=true; else if (c === '"') quoted=false; continue; }
          if (c === '"') {quoted=true;continue;}
          if (c === '{') {if (depth++ === 0) eventStart=cursor;}
          else if (c === '}' && depth > 0 && --depth === 0) {
            try {const s=segment(JSON.parse(body.slice(eventStart,cursor+1)));if(s){count++;if(preview.length<80)preview.push(s);}} catch { /* Full JSON validation below remains authoritative. */ }
          } else if (c === ']' && depth === 0) {eventsEnded=true;cursor=body.length;break;}
        }
      }
      if (result.body?.getReader) {
        const reader=result.body.getReader(); const decoder=new TextDecoder();
        try {
          while (true) {
            const {done,value}=await reader.read();
            if (done) break;
            if (controller.signal.aborted) throw controller.signal.reason;
            bytes+=value.byteLength;
            if(bytes>20*1024*1024)throw fail('TOO_LARGE','This transcript is too large to load in the popup.');
            body+=decoder.decode(value,{stream:true}); partial();
            report({phase:'receiving',bytes,segments:count,preview:preview.slice()});
          }
          body+=decoder.decode();
        } catch(error) {
          await reader.cancel().catch(()=>{});
          if (!controller.signal.aborted && error instanceof TypeError) throw fail('NETWORK_ERROR','The connection to YouTube was interrupted. Try again.',true);
          throw error;
        }
        finally {reader.releaseLock();}
      } else {body=await result.text();bytes=new TextEncoder().encode(body).length;}
      if (!body.trim()) return [];
      report({phase:'parsing',bytes,segments:count,preview:preview.slice()});
      let data;
      try {data=JSON.parse(body);} catch {throw fail('INVALID_RESPONSE','YouTube returned an unreadable caption response. We could not determine whether a transcript is available.',true);}
      if (!Array.isArray(data.events)) throw fail('INVALID_RESPONSE','YouTube returned an unexpected caption response.',true);
      return data.events.map(segment).filter(Boolean);
    }
    let segments=await fetchTrack(track,'include');
    if (!segments.length) {
      report({phase:'fallback',bytes:0,preview:[]});
      const alternate=await request('/youtubei/v1/player',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({context:{client:{clientName:'ANDROID',clientVersion:'20.10.38'}},videoId:id})});
      let data;
      try {data=await alternate.json();} catch {throw fail('INVALID_RESPONSE','YouTube returned an unreadable player response.',true);}
      if (data.playabilityStatus?.status && data.playabilityStatus.status !== 'OK')
        throw fail('ACCESS_RESTRICTED', typeof data.playabilityStatus.reason === 'string' ? data.playabilityStatus.reason : 'YouTube reports that this video is unavailable.');
      const matching=data.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(t=>t.languageCode===track.language && (t.kind||'')===track.kind);
      if(matching) segments=await fetchTrack(matching,'omit');
    }
    if (!segments.length) throw fail('EMPTY_RESPONSE', "YouTube did not return caption text. We couldn't determine why.", true);
    if (controller.signal.aborted) throw controller.signal.reason;
    const current=new URL(location.href);
    const currentId=current.searchParams.get('v') || current.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/)?.[1];
    if(currentId!==id)throw fail('VIDEO_CHANGED','The video changed while captions were loading. Reload the video details.',true);
    return {...metadata,language:track.language,segments};
  } catch(error) {
    const actual=controller?.signal.aborted ? controller.signal.reason : error;
    const code=actual?.name==='TimeoutError'?'TIMEOUT':actual?.name==='AbortError'?'CANCELLED':actual?.code || 'UNKNOWN';
    return {error:actual?.message || String(actual),code,retryable:code==='TIMEOUT' || actual?.retryable===true};
  } finally {
    clearTimeout(timeout);
    if(requestId)globalThis.__transcriptRequests?.delete(requestId);
  }
}

export function cancelCaptionRequest(requestId) {
  globalThis.__transcriptRequests?.get(requestId)?.abort();
}
