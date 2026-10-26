import assert from 'node:assert/strict';
const events = {};
const event = name => ({addListener: fn => events[name] = fn});
const tabs = new Map([[1,{id:1,url:'https://chatgpt.com/'}],[2,{id:2,url:'https://www.youtube.com/'}]]);
const states = new Map();
const state = id => {if(!states.has(id))states.set(id,{});return states.get(id);};
let cleared = false;
globalThis.chrome = {
 runtime:{onInstalled:event('installed'),onStartup:event('startup')},
 tabs:{get:async id=>{if(!tabs.has(id))throw Error('closed');return tabs.get(id);},query:async()=>[...tabs.values()],onUpdated:event('updated'),onActivated:event('activated'),onCreated:event('created'),onReplaced:event('replaced')},
 action:{disable:async id=>state(id).enabled=false,enable:async id=>state(id).enabled=true,
 setIcon:async ({tabId,path})=>state(tabId).path=path,setPopup:async ({tabId,popup})=>state(tabId).popup=popup,setTitle:async ({tabId,title})=>state(tabId).title=title},
 declarativeContent:{onPageChanged:{removeRules:(_,done)=>{cleared=true;done();}}}
};
const {isSupported,refreshTab}=await import('../background-v2.js');
for(const url of ['https://youtube.com/','https://www.youtube.com/watch?v=x','https://m.youtube.com/shorts/x'])assert(isSupported(url));
for(const url of ['https://chatgpt.com/','https://youtube.com.evil.com/','https://notyoutube.com/','https://studio.youtube.com/','http://youtube.com/','chrome://newtab/','about:blank',undefined])assert(!isSupported(url));
await events.installed();assert(cleared);assert.equal(state(1).enabled,false);assert.equal(state(2).enabled,true);
for(const [url,enabled] of [['https://www.youtube.com/',true],['https://chatgpt.com/',false],['https://example.com/',false],['https://www.youtube.com/watch?v=x',true],['chrome://newtab/',false]]){
 tabs.set(1,{id:1,url});await events.updated(1,{url});
 assert.equal(state(1).enabled,enabled);assert.equal(state(1).popup,enabled?'popup.html':'');
 assert.equal(state(1).path[16],enabled?'icons/icon-16.png':'icons/disabled-16.png');
}
tabs.set(1,{id:1,url:'https://www.youtube.com/',pendingUrl:'https://chatgpt.com/'});await refreshTab(1);assert.equal(state(1).enabled,false);
tabs.set(1,{id:1,url:'https://www.youtube.com/'});const first=refreshTab(1);tabs.set(1,{id:1,url:'https://chatgpt.com/'});await Promise.all([first,refreshTab(1)]);assert.equal(state(1).enabled,false);
await events.activated({tabId:2});assert.equal(state(2).enabled,true);
await events.startup();assert.equal(state(1).enabled,false);assert.equal(state(2).enabled,true);
tabs.delete(1);await refreshTab(1);
console.log('PASS: explicit grey/green icons, disable/enable, popup removal, navigation, pending URLs, switching tabs, startup and closed tabs.');
