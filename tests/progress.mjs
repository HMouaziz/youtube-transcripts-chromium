import assert from 'node:assert/strict';
import {readCaptions,cancelCaptionRequest} from '../captions.js';
const id='jNQXAC9IVRw';
const metadata={id,title:'Test',tracks:[{name:'English',language:'en',kind:'',baseUrl:'https://www.youtube.com/api/timedtext?v='+id}]};
globalThis.location={href:'https://www.youtube.com/watch?v='+id};
const messages=[];
globalThis.chrome={runtime:{sendMessage:async m=>messages.push(m)}};
const enc=new TextEncoder();
const event={tStartMs:0,dDurationMs:1500,segs:[{utf8:'Hello 🌍 "quoted" {text}'}]};
const first='{"events":['+JSON.stringify(event)+',';
let stream;
globalThis.fetch=async()=>new Response(new ReadableStream({start(c){stream=c;}}));
let completed=false;
const result=readCaptions(0,id,{metadata,requestId:'stream'}).then(r=>{completed=true;return r;});
await new Promise(r=>setTimeout(r,0));
// Split every UTF-8 byte: decoding and parser state must survive all boundaries.
for(const byte of enc.encode(first))stream.enqueue(new Uint8Array([byte]));
await new Promise(r=>setTimeout(r,0));
assert(!completed,'The HTTP response must still be open');
const partial=messages.find(m=>m.preview?.length);
assert(partial,'A complete caption entry must be reported before EOF');
assert.equal(partial.preview[0].text,event.segs[0].utf8);
assert(partial.bytes>0);assert.equal(partial.videoId,id);
stream.enqueue(enc.encode(JSON.stringify({tStartMs:1500,dDurationMs:500,segs:[{utf8:'Second'}]})+']}'));
stream.close();const full=await result;
assert.equal(full.segments.length,2);
assert.equal(globalThis.__transcriptRequests.size,0);

// Incomplete/malformed bodies never become a completed transcript, even after a preview.
messages.length=0;
globalThis.fetch=async()=>new Response(first+'BROKEN');
const malformed=await readCaptions(0,id,{metadata,requestId:'malformed'});
assert.equal(malformed.code,'INVALID_RESPONSE');assert(!malformed.segments);

// A connection lost after a preview is a retryable network failure, never a transcript.
globalThis.fetch=async()=>new Response(new ReadableStream({start(c){stream=c;}}));
const interrupted=readCaptions(0,id,{metadata,requestId:'interrupted'});
await new Promise(r=>setTimeout(r,0));stream.enqueue(enc.encode(first));
await new Promise(r=>setTimeout(r,0));stream.error(new TypeError('connection lost'));
const lost=await interrupted;assert.equal(lost.code,'NETWORK_ERROR');assert(lost.retryable);assert(!lost.segments);

// Do not mistake objects after the events array for captions in a later chunk.
messages.length=0;
globalThis.fetch=async()=>new Response(new ReadableStream({start(c){stream=c;}}));
const trailing=readCaptions(0,id,{metadata,requestId:'trailing'});
await new Promise(r=>setTimeout(r,0));stream.enqueue(enc.encode('{"events":['+JSON.stringify(event)+']'));
await new Promise(r=>setTimeout(r,0));stream.enqueue(enc.encode(',"other":{"segs":[{"utf8":"not a caption"}]}}'));stream.close();
assert.equal((await trailing).segments.length,1);
assert(messages.every(m=>!m.preview?.some(s=>s.text==='not a caption')));

// Cancellation interrupts actual fetch signals, with no retry/fallback.
let calls=0;
globalThis.fetch=async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});};
const cancelling=readCaptions(0,id,{metadata,requestId:'cancel'});
await new Promise(r=>setTimeout(r,0));cancelCaptionRequest('cancel');
assert.equal((await cancelling).code,'CANCELLED');assert.equal(calls,1);
assert.equal(globalThis.__transcriptRequests.size,0);

// Empty results are unknown retrieval failures, not a false no-captions claim.
calls=0;
globalThis.fetch=async()=>{calls++;return calls===1?new Response(''):new Response('{}');};
const empty=await readCaptions(0,id,{metadata});
assert.equal(empty.code,'EMPTY_RESPONSE');assert.match(empty.error,/couldn't determine why/);
for(const [status,code] of [[429,'RATE_LIMITED'],[403,'ACCESS_RESTRICTED'],[500,'SERVER_ERROR']]){
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status});};
 const failure=await readCaptions(0,id,{metadata});assert.equal(failure.code,code);assert.equal(calls,1);
}
globalThis.fetch=async()=>{throw new TypeError('network');};
assert.equal((await readCaptions(0,id,{metadata})).code,'NETWORK_ERROR');
globalThis.fetch=async()=>{throw new DOMException('slow','TimeoutError');};
assert.equal((await readCaptions(0,id,{metadata})).code,'TIMEOUT');
let response={videoDetails:{videoId:id,title:'Test'},playabilityStatus:{status:'OK'}};
globalThis.document={getElementById:()=>({getPlayerResponse:()=>response})};
globalThis.fetch=()=>{throw Error('Metadata must not fetch');};
assert.equal((await readCaptions()).code,'NO_CAPTIONS');
response.playabilityStatus={status:'LOGIN_REQUIRED',reason:'Sign in to view this video.'};
const access=await readCaptions();assert.equal(access.code,'ACCESS_RESTRICTED');assert.equal(access.error,response.playabilityStatus.reason);
response.playabilityStatus={status:'OK'};response.captions={playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:metadata.tracks[0].baseUrl,languageCode:'en'}]}};
assert.equal((await readCaptions()).tracks.length,1);
console.log('PASS: progressive UTF-8 preview before EOF, final validation, cancellation, typed availability, bounded retries and network-free metadata.');
