import { loadConfig } from './config.js';

const $=id=>document.getElementById(id);
const state={config:null,rows:[],selected:null,persona:'All Personas',credential:null,user:null,IdentityManager:null};
const t=v=>v==null?'':String(v);
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=t(value);return n;};
function toast(msg,kind=''){const n=el('div',`toast ${kind}`,msg);$('toastRegion').append(n);setTimeout(()=>n.remove(),5000);}
function signedOut(message='Sign in with your ArcGIS organization account to load the private request queue.'){
  state.credential=null;state.user=null;$('sessionUser').textContent='Not signed in';$('sessionButton').textContent='Sign in';$('sessionDot').classList.remove('online');
  $('queue').replaceChildren(el('li','empty-state',message));$('refresh').disabled=true;
  $('diagnostic').className='diagnostic';$('diagnostic').textContent='Sign-in is required before requests or live Workflow Manager steps can be verified.';
  [$('approve'),$('deny'),$('advance')].forEach(b=>b.disabled=true);
}
async function setUser(credential){
  const r=await fetch(`${state.config.portalUrl}/sharing/rest/community/self?f=json&token=${encodeURIComponent(credential.token)}`);const user=await r.json();if(user.error)throw new Error(user.error.message);
  state.credential=credential;state.user=user;$('sessionUser').textContent=user.fullName||user.username;$('sessionButton').textContent='Sign out';$('sessionDot').classList.add('online');$('refresh').disabled=false;
}
async function query(){
  if(!state.credential?.token){signedOut();return;}
  const url=`${state.config.featureServiceUrl}/${state.config.layers.requests}/query`;const p=new URLSearchParams({f:'json',where:'1=1',outFields:'*',returnGeometry:'false',orderByFields:'OBJECTID DESC',token:state.credential.token});const r=await fetch(url,{method:'POST',body:p});const j=await r.json();if(j.error)throw new Error(j.error.message);state.rows=j.features||[];render();
}
function filtered(){const q=$('search').value.toLowerCase();const status=$('status').value;const type=$('type').value.toLowerCase();const need=$('needed').value?new Date($('needed').value).getTime():null;return state.rows.filter(f=>{const a=f.attributes;const hay=[a.RequestTitle,a.IncidentName,a.WFMJobId,a.Requestor].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!status||a.RequestStatus===status)&&(!type||[a.RequestedKind,a.RequestedType].join(' ').toLowerCase().includes(type))&&(!need||Number(a.DateNeeded)<=need+86400000);}).sort((x,y)=>{const k=$('sort').value;return k==='title'?t(x.attributes.RequestTitle).localeCompare(t(y.attributes.RequestTitle)):k==='priority'?t(x.attributes.Priority).localeCompare(t(y.attributes.Priority)):Number(x.attributes.DateNeeded||0)-Number(y.attributes.DateNeeded||0);});}
function render(){const list=$('queue');list.replaceChildren();for(const f of filtered()){const a=f.attributes;const b=el('button',`queue-card${state.selected===f?' selected':''}`);b.type='button';const line=el('div','card-line');line.append(el('span','card-title',a.RequestTitle||'Untitled request'),el('span','status status-neutral',a.RequestStatus||'Unknown'));b.append(line,el('div','card-meta',`${a.Priority||'No priority'} · ${a.IncidentName||'No incident'}\nJob ${a.WFMJobId||'NOT LINKED'}`));b.onclick=()=>select(f);list.append(b);}if(!list.children.length)list.append(el('li','empty-state','No requests match the filters.'));}
function select(f){state.selected=f;render();const a=f.attributes;const d=$('detail');d.replaceChildren();const hero=el('div','detail-hero');hero.append(el('span','status status-neutral',a.RequestStatus||'Unknown'),el('h2','',a.RequestTitle||'Untitled request'),el('p','',`${a.IncidentName||'No incident'} · ${a.Requestor||'Unknown requestor'}`));const section=el('div','panel-section');const grid=el('div','detail-grid');for(const [k,v] of [['Job ID',a.WFMJobId||'—'],['GlobalID',a.GlobalID||'—'],['Priority',a.Priority||'—'],['Needed',a.DateNeeded?new Date(a.DateNeeded).toLocaleDateString():'—'],['Category',a.RequestedCategory||'—'],['Kind / Type',[a.RequestedKind,a.RequestedType].filter(Boolean).join(' / ')||'—'],['Integration',a.IntegrationState||'—'],['Quantity',a.QuantityRequested??'—']]){const x=el('div','detail-item');x.append(el('span','',k),el('strong','',v));grid.append(x);}section.append(grid);d.append(hero,section);verify(a);}
function verify(a){const diag=$('diagnostic');[$('approve'),$('deny'),$('advance')].forEach(b=>b.disabled=true);let message='';if(!state.credential)message='Sign-in is required.';else if(!a.WFMJobId)message='WFMJobId is blank. No workflow action is allowed.';else if(a.IntegrationState!=='Linked')message=`Integration state is ${a.IntegrationState||'blank'}; expected Linked.`;else message='The link is present. A live Workflow Manager job and current-step read-back must still succeed before an action is enabled.';diag.className='diagnostic';diag.textContent=message;}
function setupEvents(){
  for(const id of ['search','status','needed','type','sort'])$(id).addEventListener(id==='search'||id==='type'?'input':'change',render);
  $('refresh').onclick=()=>query().catch(e=>{toast(e.message,'error');if(/token|required|498|499/i.test(e.message))signedOut('Your ArcGIS session expired. Sign in again.');});
  $('personas').addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){[...$('personas').children].forEach(x=>x.classList.remove('active'));e.target.classList.add('active');state.persona=e.target.textContent;render();}});
  for(const id of ['approve','deny','advance'])$(id).onclick=()=>toast('Action blocked until a live Workflow Manager step verification succeeds.','error');
}
async function setupAuth(){
  return new Promise(resolve=>window.require(['esri/config','esri/identity/IdentityManager','esri/identity/OAuthInfo'],async(esriConfig,IdentityManager,OAuthInfo)=>{
    esriConfig.portalUrl=state.config.portalUrl;state.IdentityManager=IdentityManager;
    IdentityManager.registerOAuthInfos([new OAuthInfo({appId:state.config.oauthClientId,portalUrl:state.config.portalUrl,popup:true})]);
    $('sessionButton').onclick=async()=>{if(state.user){IdentityManager.destroyCredentials();signedOut();return;} $('sessionButton').disabled=true;try{const c=await IdentityManager.getCredential(`${state.config.portalUrl}/sharing`);await setUser(c);await query();}catch(e){signedOut();if(!/cancel/i.test(e?.message||''))toast(e.message||'Sign-in was not completed.','error');}finally{$('sessionButton').disabled=false;}};
    const c=await IdentityManager.checkSignInStatus(`${state.config.portalUrl}/sharing`).catch(()=>null);if(c){try{await setUser(c);await query();}catch(e){signedOut('Your ArcGIS session could not be restored. Sign in again.');}}else signedOut();resolve();
  }));
}
(async()=>{setupEvents();try{state.config=await loadConfig();await setupAuth();}catch(e){signedOut(e.message);toast(e.message,'error');}})();