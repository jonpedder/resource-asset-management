import { loadConfig } from './config.js';
import { createLinkedRequest } from './request-saga.js';

const $ = (id) => document.getElementById(id);
const state = { config: null, view: null, resources: [], requests: [], selected: null, user: null, requestPoll: null };
const text = (v) => v == null ? '' : String(v);
const statusClass = (v) => `status-${text(v).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'neutral'}`;

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = text(value);
  return node;
}
function toast(message, kind = '') {
  const node = el('div', `toast ${kind}`, message); $('toastRegion').append(node); setTimeout(() => node.remove(), 6500);
}
function setStatus(message, error = false) {
  $('systemStatus').textContent = message; $('systemStatus').style.color = error ? 'var(--app-red)' : '';
}
function attrs(feature) { return feature?.attributes || feature || {}; }

function unique(field) { return [...new Set(state.resources.map(r => text(attrs(r)[field])).filter(Boolean))].sort(); }
function checked(container) { return [...container.querySelectorAll('input:checked')].map(n => n.value); }
function buildChecks(containerId, field, values) {
  const box = $(containerId); box.replaceChildren();
  for (const value of values) {
    const label = el('label', 'check'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = value;
    input.addEventListener('change', renderResources); label.append(input, document.createTextNode(value)); box.append(label);
  }
}
function filteredResources() {
  const q = $('resourceSearch').value.trim().toLowerCase();
  const statuses = checked($('statusFilters')); const categories = checked($('categoryFilters')); const typing = checked($('typingFilters'));
  return state.resources.filter(r => { const a = attrs(r); const hay = [a.ResourceName,a.OwningAgency,a.SiteName,a.NIMS_Category,a.NIMS_Kind,a.TypeClass].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!statuses.length || statuses.includes(text(a.Status))) && (!categories.length || categories.includes(text(a.NIMS_Category))) && (!typing.length || typing.includes(text(a.NIMS_Kind)) || typing.includes(text(a.TypeClass))); });
}
function renderResources() {
  const list = $('resourceList'); list.replaceChildren(); const rows = filteredResources(); $('visibleCount').textContent = rows.length;
  for (const feature of rows) {
    const a = attrs(feature); const button = el('button', `resource-card${state.selected === feature ? ' selected' : ''}`); button.type = 'button';
    const line = el('div','card-line'); line.append(el('span','card-title',a.ResourceName || 'Unnamed resource'), el('span',`status ${statusClass(a.Status)}`,a.Status || 'Unknown'));
    button.append(line, el('div','card-meta',`${a.NIMS_Category || 'Unclassified'} · ${a.NIMS_Kind || 'Unknown kind'} · ${a.TypeClass || 'Unspecified'}\n${a.OwningAgency || 'No agency'} · Qty ${a.Quantity ?? 0}`));
    button.addEventListener('click', () => selectResource(feature)); list.append(button);
  }
  if (!rows.length) list.append(el('li','empty-state','No resources match the current filters.'));
}
function selectResource(feature) {
  state.selected = feature; renderResources(); const a = attrs(feature); const root = $('resourceDetail'); root.replaceChildren();
  const hero = el('div','detail-hero'); hero.append(el('span',`status ${statusClass(a.Status)}`,a.Status || 'Unknown'), el('h2','',a.ResourceName || 'Unnamed resource'), el('p','',`${a.OwningAgency || 'No owning agency'} · ${a.SiteName || 'No assigned site'}`));
  const section = el('div','panel-section'); const grid = el('div','detail-grid');
  for (const [label,value] of [['Quantity',a.Quantity],['Category',a.NIMS_Category],['Kind',a.NIMS_Kind],['Type',a.TypeClass],['Agency',a.OwningAgency],['Site',a.SiteName]]) { const item=el('div','detail-item'); item.append(el('span','',label),el('strong','',value ?? '—')); grid.append(item); }
  const request = el('button','btn btn-primary','Create ICS 213RR request'); request.type='button'; request.style.marginTop='2.25rem'; request.disabled = !state.user; request.title = state.user ? '' : 'Sign in before creating a request'; request.addEventListener('click', openRequest);
  section.append(grid,request); root.append(hero,section); if (state.view && feature.geometry) state.view.goTo(feature.geometry, { scale: 24000 }).catch(()=>{});
}
function openRequest() { const a=attrs(state.selected); $('requestTitle').value=`Request ${a.ResourceName || 'resource'}`; $('requestedCategory').value=text(a.NIMS_Category); $('requestedKind').value=text(a.NIMS_Kind); $('requestedType').value=text(a.TypeClass); $('quantityRequested').value='1'; $('requestor').value=state.user?.email || state.user?.username || state.user?.fullName || ''; $('resourceGlobalId').value=text(a.GlobalID); $('requestDialog').showModal(); }
function renderRequests() { const list=$('requestList'); list.replaceChildren(); $('requestCount').textContent=state.requests.length; for(const r of state.requests){const a=attrs(r);const row=el('li','request-row');const h=document.createElement('header');h.append(el('strong','',a.RequestTitle||'Untitled request'),el('span',`status ${statusClass(a.IntegrationState)}`,a.IntegrationState||'Unknown'));row.append(h,el('p','',`${a.RequestStatus||'Unknown'} · Job ${a.WFMJobId||'NOT LINKED'}\n${a.IntegrationError||''}`));list.append(row);} if(!state.requests.length)list.append(el('li','empty-state','No resource requests have been submitted.')); }
function toggleDrawer(open){$('requestsDrawer').classList.toggle('open',open);$('drawerBackdrop').classList.toggle('open',open);$('requestsDrawer').setAttribute('aria-hidden',String(!open));}

async function setupArcGIS() {
  const cfg=state.config; window.require(['esri/WebMap','esri/views/MapView','esri/config','esri/identity/IdentityManager','esri/identity/OAuthInfo'], async (WebMap,MapView,esriConfig,IdentityManager,OAuthInfo)=>{
    esriConfig.portalUrl=cfg.portalUrl;
    if(cfg.oauthClientId && !cfg.oauthClientId.startsWith('NEW_')) IdentityManager.registerOAuthInfos([new OAuthInfo({appId:cfg.oauthClientId,portalUrl:cfg.portalUrl,popup:true})]);

    const showSignedOut=()=>{
      state.user=null;
      $('sessionUser').textContent='Not signed in'; $('sessionButton').textContent='Sign in'; $('sessionDot').classList.remove('online');
      setStatus('Sign-in required',true); $('lastUpdated').textContent='ArcGIS session required';
      $('mapMessage').hidden=false; $('mapMessage').querySelector('h2').textContent='Sign in required';
      $('mapMessage').querySelector('p').textContent='Sign in with your ArcGIS organization account to load the private operations map and resource data.';
    };
    const buildMap=async()=>{
      setStatus('Loading'); $('mapMessage').hidden=false; $('mapMessage').querySelector('h2').textContent='Operations Map'; $('mapMessage').querySelector('p').textContent='Loading secured ArcGIS content…';
      const map=new WebMap({portalItem:{id:cfg.webmapId}}); const view=new MapView({container:'mapView',map,ui:{components:['zoom','compass','attribution']}}); state.view=view; window.__esriView=view;window.__esriMap=map;window.__esriLayers={};
      try{await view.when();$('mapMessage').hidden=true; const layers=map.allLayers.toArray(); for(const l of layers)window.__esriLayers[l.title]=l; const resource=layers.find(l=>l.title==='Resources')||layers[0]; if(resource){const q=resource.createQuery();q.where='1=1';q.outFields=['*'];q.returnGeometry=true;state.resources=(await resource.queryFeatures(q)).features;} const facilities=layers.find(l=>l.title==='Facilities'); $('facilityTotal').textContent=facilities?await facilities.queryFeatureCount():0; $('resourceTotal').textContent=state.resources.length;$('availableTotal').textContent=state.resources.filter(r=>attrs(r).Status==='Available').length; buildChecks('statusFilters','Status',unique('Status'));buildChecks('categoryFilters','NIMS_Category',unique('NIMS_Category'));buildChecks('typingFilters','NIMS_Kind',[...new Set([...unique('NIMS_Kind'),...unique('TypeClass')])]);renderResources();await loadRequests();setStatus('Operational');$('lastUpdated').textContent=`Updated ${new Date().toLocaleTimeString()}`;}catch(e){$('mapMessage').hidden=false;$('mapMessage').querySelector('p').textContent=e.message;setStatus('Content unavailable',true);}
    };
    $('sessionButton').onclick=async()=>{
      if(state.user){IdentityManager.destroyCredentials();location.reload();return;}
      $('sessionButton').disabled=true;
      try{const c=await IdentityManager.getCredential(`${cfg.portalUrl}/sharing`);await setUser(c,IdentityManager);await buildMap();}
      catch(e){showSignedOut();if(!/cancel/i.test(e?.message||''))toast(e.message||'Sign-in was not completed.','error');}
      finally{$('sessionButton').disabled=false;}
    };
    const credential=await IdentityManager.checkSignInStatus(`${cfg.portalUrl}/sharing`).catch(()=>null);
    if(!credential){showSignedOut();return;}
    try{await setUser(credential,IdentityManager);await buildMap();}catch(e){showSignedOut();toast(e.message||'The ArcGIS session could not be restored.','error');}
  });
}
async function setUser(credential, IdentityManager){const response=await fetch(`${state.config.portalUrl}/sharing/rest/community/self?f=json&token=${encodeURIComponent(credential.token)}`);state.user=await response.json();state.user.credential=credential;$('sessionUser').textContent=state.user.fullName||state.user.username;$('sessionButton').textContent='Sign out';$('sessionDot').classList.add('online');}
async function layerRequest(url, params){const body=new URLSearchParams({f:'json',...params});const response=await fetch(url,{method:'POST',body});const json=await response.json();if(json.error)throw new Error(json.error.message);return json;}
async function loadRequests(){if(!state.user?.credential?.token){state.requests=[];renderRequests();return;}try{const result=await layerRequest(`${state.config.featureServiceUrl}/${state.config.layers.requests}/query`,{where:'1=1',outFields:'*',orderByFields:'OBJECTID DESC',returnGeometry:'false',token:state.user.credential.token});state.requests=result.features||[];$('lastUpdated').textContent=`Updated ${new Date().toLocaleTimeString()}`;}catch(e){console.warn('Request refresh failed',e);if(!state.requests.length)state.requests=[];}renderRequests();}
async function submitRequest(event){event.preventDefault();if(!state.user)return toast('Sign in before submitting a request.','error');const submit=$('submitRequest');submit.disabled=true;$('requestError').hidden=true;const attributes=Object.fromEntries(new FormData(event.currentTarget));attributes.QuantityRequested=Number(attributes.QuantityRequested);attributes.DateNeeded=new Date(`${attributes.DateNeeded}T12:00:00`).getTime();
  try{const token=state.user?.credential?.token; if(!token)throw new Error('A current ArcGIS credential is required.'); const table=`${state.config.featureServiceUrl}/${state.config.layers.requests}`;
    const result=await createLinkedRequest({attributes,createRequest:async a=>{const added=await layerRequest(`${table}/addFeatures`,{features:JSON.stringify([{attributes:a}]),token});const oid=added.addResults?.[0]?.objectId;if(!oid)throw new Error('Feature creation was not acknowledged.');const read=await layerRequest(`${table}/query`,{objectIds:String(oid),outFields:'*',returnGeometry:'false',token});return read.features[0].attributes;},findJobsByRequestGlobalId:async()=>[],createJob:async()=>{throw new Error('Workflow job creation requires the deployment OAuth application to be registered and enabled. The request remains Failed for safe retry.');},verifyJob:async()=>{},linkRequest:async()=>{},verifyRequestLink:async()=>{}}); toast(`Request ${result.request.OBJECTID} linked to job ${result.jobId}`,'success');$('requestDialog').close();await loadRequests();}catch(e){$('requestError').textContent=e.message;$('requestError').hidden=false;toast(e.message,'error');}finally{submit.disabled=false;}}

async function init(){try{state.config=await loadConfig();document.querySelectorAll('[data-brand-name]').forEach(n=>n.textContent=state.config.branding?.appName||'Resource & Asset Management');document.querySelectorAll('[data-brand-subtitle]').forEach(n=>n.textContent=state.config.branding?.subtitle||'FEMA NIMS Common Operating Picture');setupArcGIS();}catch(e){setStatus('Not configured',true);$('mapMessage').querySelector('p').textContent=e.message;}
  $('resourceSearch').addEventListener('input',renderResources);$('clearFilters').onclick=()=>{document.querySelectorAll('.check input').forEach(n=>n.checked=false);$('resourceSearch').value='';renderResources();};$('requestsButton').onclick=()=>toggleDrawer(true);$('closeDrawer').onclick=()=>toggleDrawer(false);$('drawerBackdrop').onclick=()=>toggleDrawer(false);$('closeRequestDialog').onclick=()=>$('requestDialog').close();$('cancelRequest').onclick=()=>$('requestDialog').close();$('requestForm').addEventListener('submit',submitRequest);const notes=$('requestNotes');const sizeNotes=()=>{notes.style.height='auto';notes.style.height=`${Math.max(120,notes.scrollHeight)}px`;};notes.addEventListener('input',sizeNotes);sizeNotes();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user)loadRequests();});state.requestPoll=setInterval(()=>{if(!document.hidden&&state.user)loadRequests();},30000);renderRequests();}
init();
