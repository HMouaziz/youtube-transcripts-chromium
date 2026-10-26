export function availabilityMessage(result) {
  const titles = {
    SAVE_FAILED: "Couldn't save the transcript", NO_CAPTIONS:'No transcript available', ACCESS_RESTRICTED:'Transcript access restricted',
    RATE_LIMITED:'YouTube is limiting requests', NETWORK_ERROR:'Connection problem', TIMEOUT:'YouTube took too long to respond',
    NOT_VIDEO:'Open a YouTube video', PLAYER_LOADING:'Video is still loading', VIDEO_CHANGED:'Video changed',
    TRACK_CHANGED:'Caption selection changed', EMPTY_RESPONSE:"Couldn't retrieve the transcript",
    INVALID_RESPONSE:"Couldn't read YouTube's response", TOO_LARGE:'Transcript is too large', CANCELLED:'Loading cancelled'
  };
  return {title:titles[result.code] || "Couldn't retrieve the transcript",
    detail:result.code==='TIMEOUT'?'The request timed out. You can try again.':result.error || "We couldn't determine why.",
    retryable:result.retryable===true, code:result.code || 'UNKNOWN'};
}

export function createPopupController({readMetadata,fetchTrack,cancel,save,render,newId=()=>crypto.randomUUID()}) {
  const state={stage:'metadata',metadata:null,selection:0,format:'txt',preview:[],bytes:0,received:0,data:null,error:null,queued:false,requestId:null};
  let generation=0, disposed=false;
  const emit=()=>{if(!disposed)render({...state});};
  function stop() {if(state.requestId)cancel(state.requestId);state.requestId=null;}
  function failure(result){state.stage='error';state.error=availabilityMessage(result);state.queued=false;state.data=null;state.preview=[];emit();}
  async function write() {
    if(!state.data || disposed || state.stage==='saving')return;
    const version=generation;state.stage='saving';state.queued=false;emit();
    try {await save(state.data,state.format);if(version===generation&&!disposed){state.stage='saved';emit();}}
    catch(error){if(version===generation&&!disposed){state.stage='ready';state.error=availabilityMessage({code:'SAVE_FAILED',error:error.message});emit();}}
  }
  async function select(index) {
    stop();const version=++generation;
    Object.assign(state,{selection:index,stage:'connecting',preview:[],bytes:0,received:0,data:null,error:null,queued:false,requestId:newId()});emit();
    const requestId=state.requestId;
    let result;
    try {result=await fetchTrack(index,state.metadata,requestId);}
    catch(error){result={code:'UNKNOWN',error:error.message,retryable:true};}
    if(version!==generation||disposed)return;
    state.requestId=null;
    if(result.error){failure(result);return;}
    if(!Array.isArray(result.segments)||!result.segments.length){failure({code:'EMPTY_RESPONSE',error:"YouTube returned no caption text. We couldn't determine why.",retryable:true});return;}
    state.data=result;state.preview=result.segments.slice(0,80);state.received=result.segments.length;state.stage='ready';emit();
    if(state.queued)await write();
  }
  async function load() {
    stop();const version=++generation;
    Object.assign(state,{stage:'metadata',metadata:null,data:null,error:null,preview:[],received:0,bytes:0,queued:false});emit();
    let result;
    try{result=await readMetadata();}catch(error){result={code:'UNKNOWN',error:error.message,retryable:true};}
    if(version!==generation||disposed)return;
    if(result.error){failure(result);return;}
    state.metadata=result;state.selection=0;emit();
    void select(0);
  }
  function progress(message) {
    if(disposed||message.requestId!==state.requestId||message.videoId!==state.metadata?.id)return;
    if(!['connecting','receiving','fallback','parsing'].includes(message.phase))return;
    state.stage=message.phase;
    state.bytes=Number.isFinite(message.bytes)?Math.max(0,message.bytes):0;
    state.received=Number.isFinite(message.segments)?Math.max(0,message.segments):0;
    state.preview=Array.isArray(message.preview)?message.preview.slice(0,80).filter(s=>typeof s.text==='string'):[];
    emit();
  }
  return {
    load,select,progress,
    format(value){if(['txt','json','srt','vtt'].includes(value))state.format=value;},
    download(){if(state.data)return write();if(state.metadata&&state.requestId){state.queued=true;emit();}},
    retry(){return load();},
    dispose(){disposed=true;generation++;stop();}
  };
}
