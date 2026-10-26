import {readCaptions,cancelCaptionRequest} from './captions.js';
import {formatTranscript,filename} from './format.js';
import {followSystemTheme} from './theme.js';
import {createPopupController} from './popup-state.js';
followSystemTheme();
const $=id=>document.getElementById(id);
let tabId, renderedMetadata;
async function inject(func,args,world='ISOLATED') {
  const [injection]=await chrome.scripting.executeScript({target:{tabId},world,func,args});
  return injection?.result || {error:'Cannot read this tab. Open a YouTube video.',code:'NOT_VIDEO'};
}
const controller=createPopupController({
  async readMetadata(){
    if(!tabId){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab.id;}
    const tab=await chrome.tabs.get(tabId);
    if(!/^https:\/\/(www\.|m\.)?youtube\.com\//.test(tab.url||''))return {code:'NOT_VIDEO',error:'Open a YouTube video, then click this extension.'};
    return inject(readCaptions,[],'MAIN');
  },
  fetchTrack:(index,metadata,requestId)=>inject(readCaptions,[index,metadata.id,{metadata,requestId}]),
  cancel:requestId=>{if(tabId)void inject(cancelCaptionRequest,[requestId]).catch(()=>{});},
  async save(data,format){
    // Recheck the video before exporting a cached result after navigation.
    const current=await inject(readCaptions,[],'MAIN');
    if(current.error||current.id!==data.id)throw Error('The video changed. Use Check again before downloading.');
    const objectUrl=URL.createObjectURL(new Blob([formatTranscript(data.segments,format)],{type:'text/plain;charset=utf-8'}));
    try {await chrome.downloads.download({url:objectUrl,filename:filename(data.title,data.id,data.language,format),saveAs:true,conflictAction:'uniquify'});}
    finally{setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);}
  },
  render(state){
    if(state.metadata!==renderedMetadata){
      renderedMetadata=state.metadata;$('language').replaceChildren();
      state.metadata?.tracks.forEach((t,i)=>$('language').add(new Option(t.name,i)));
    }
    $('video').textContent=state.metadata?.title || (state.stage==='metadata'?'Reading video details…':'YouTube transcript');
    $('language').value=String(state.selection);
    $('language').disabled=!state.metadata||state.stage==='saving';
    $('format').disabled=state.stage==='saving';
    const loading=['metadata','connecting','receiving','fallback','parsing'].includes(state.stage);
    $('progress').hidden=!loading;
    $('download').disabled=!state.metadata||state.stage==='error'||state.queued||state.stage==='saving';
    $('download').textContent=state.stage==='saving'?'Saving…':state.queued?'Download queued':state.data?'Download transcript':'Download when ready';
    const messages={metadata:'Checking available caption languages…',connecting:'Requesting captions…',
      receiving:`Receiving captions · ${(state.bytes/1024).toFixed(1)} KB${state.received?` · ${state.received} ${state.received===1?'segment':'segments'}`:''}`,
      fallback:'YouTube returned an empty response. Trying its alternate caption endpoint…',parsing:'Checking the complete transcript…',
      ready:`Transcript ready · ${state.received} ${state.received===1?'segment':'segments'}`,saving:'Opening the save dialog…',saved:'Download started.'};
    $('status').textContent=state.error?`${state.error.title}. ${state.error.detail}`:(messages[state.stage]||'');
    if(state.queued)$('status').textContent+=' Keep this popup open to save when ready.';
    $('retry').hidden=state.stage!=='error' && !state.error;
    $('retry').textContent=state.error?.retryable?'Try again':'Check again';
  }
});
chrome.runtime.onMessage.addListener((message,sender)=>{
  if(sender.id===chrome.runtime.id&&sender.tab?.id===tabId&&message?.type==='transcript-progress')controller.progress(message);
});
$('download').addEventListener('click',()=>controller.download());
$('retry').addEventListener('click',()=>controller.retry());
$('language').addEventListener('change',()=>controller.select(Number($('language').value)));
$('format').addEventListener('change',()=>controller.format($('format').value));
window.addEventListener('pagehide',()=>controller.dispose(),{once:true});
void controller.load();
