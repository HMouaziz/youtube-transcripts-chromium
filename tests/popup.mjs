import assert from 'node:assert/strict';
import {createPopupController,availabilityMessage} from '../popup-state.js';
const metadata={id:'video',title:'Test',tracks:[{name:'English'},{name:'French'}]};
const frames=[],requests=[],cancelled=[],saved=[];let serial=0;
const controller=createPopupController({readMetadata:async()=>metadata,
 fetchTrack:(index,m,requestId)=>new Promise(resolve=>requests.push({index,requestId,resolve})),
 cancel:id=>cancelled.push(id),save:async(data,format)=>saved.push({data,format}),render:s=>frames.push(s),newId:()=>String(++serial)});
const current=()=>frames.at(-1);
await controller.load();
assert.equal(requests.length,1);assert.equal(current().metadata.title,'Test');assert.equal(current().stage,'connecting');
controller.progress({requestId:'1',videoId:'video',phase:'receiving',bytes:100,segments:1,preview:[{text:'First'}]});
assert.equal(current().preview[0].text,'First');assert(!current().data);
controller.download();assert.equal(saved.length,0);assert(current().queued);
controller.format('vtt');
const selecting=controller.select(1);assert(cancelled.includes('1'));assert(!current().queued);
controller.progress({requestId:'1',videoId:'video',phase:'receiving',bytes:200,preview:[{text:'stale'}]});
assert.equal(current().preview.length,0);
requests[0].resolve({id:'video',segments:[{text:'wrong language'}]});await new Promise(r=>setTimeout(r,0));assert.equal(saved.length,0);
controller.download();requests[1].resolve({id:'video',segments:[{text:'Bonjour'}]});await selecting;
assert.equal(saved.length,1);assert.equal(saved[0].format,'vtt');assert.equal(saved[0].data.segments[0].text,'Bonjour');
controller.format('json');await controller.download();assert.equal(saved.length,2);assert.equal(requests.length,2,'Changing format reuses completed data');
await controller.retry();assert.equal(requests.length,3);
controller.download();requests[2].resolve({code:'EMPTY_RESPONSE',error:"We couldn't determine why.",retryable:true});await new Promise(r=>setTimeout(r,0));
assert.equal(current().stage,'error');assert(!current().queued);assert.equal(saved.length,2);assert.equal(current().preview.length,0);
assert.notEqual(availabilityMessage({code:'EMPTY_RESPONSE'}).title,availabilityMessage({code:'NO_CAPTIONS'}).title);
await controller.retry();controller.dispose();requests[3].resolve({id:'video',segments:[{text:'closed'}]});await new Promise(r=>setTimeout(r,0));assert.equal(saved.length,2);assert(cancelled.includes('4'));
console.log('PASS: metadata before completion, speculative fetch, live preview, queued complete-only save, language cancellation, stale results, cached format exports, retry and disposal.');
