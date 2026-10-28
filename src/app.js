import { loadConfig } from './config.js';
import { createLinkedRequest } from './request-saga.js';
import { applyPresentation } from './presentation.js';
import { WorkflowClient, workflowBaseUrl, jobExtendedProperty } from './workflow-client.js?v=20261028-4';

const $ = (id) => document.getElementById(id);
const state = { config: null, view: null, resourceLayer: null, selectionHighlight: null, resources: [], requests: [], selected: null, user: null, requestPoll: null };
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
    button.append(line, el('div','card-meta',`${a.NIMS_Category || 'Unclassified'} · ${a.NIMS_Kind || 'Unknown kind'} · ${a.TypeClass || 'Unspecified'}\n${a.OwningAgency || 'No agency'} · Qty ${a.Quantity ?? 0}`),el('span','request-hint','Select to request this asset'));
    button.addEventListener('click', () => selectResource(feature)); list.append(button);
  }
  if (!rows.length) list.append(el('li','empty-state','No resources match the current filters.'));
}
async function highlightSelectedResource(feature) {
  state.selectionHighlight?.remove();
  state.selectionHighlight=null;
  if (!state.view || !state.resourceLayer || !feature) return;
  try {
    const layerView=await state.view.whenLayerView(state.resourceLayer);
    state.selectionHighlight=layerView.highlight(feature);
  } catch (error) { console.warn('Resource highlight failed',error); }
}
function resourceLocation(feature) {
  const a=attrs(feature); const point=feature?.geometry;
  const longitude=Number(point?.longitude); const latitude=Number(point?.latitude);
  const coordinates=Number.isFinite(longitude)&&Number.isFinite(latitude) ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '';
  return [text(a.SiteName),coordinates].filter(Boolean).join(' · ') || 'Location not recorded';
}
function selectResource(feature) {
  state.selected = feature;
  renderResources();
  openRequest();
  highlightSelectedResource(feature);
  if (state.view && feature.geometry) state.view.goTo({ target: feature.geometry, scale: 24000 }, { duration: 650 }).catch(()=>{});
}
function openRequest() {
  const a=attrs(state.selected);
  $('requestTitle').value=`Request ${a.ResourceName || 'resource'}`;
  $('requestedCategory').value=text(a.NIMS_Category);
  $('requestedKind').value=text(a.NIMS_Kind);
  $('requestedType').value=text(a.TypeClass);
  $('quantityRequested').value='1';
  $('requestor').value=state.user?.email || state.user?.username || state.user?.fullName || '';
  $('resourceGlobalId').value=text(a.GlobalID);
  $('resourceLocation').value=resourceLocation(state.selected);
  if(!$('dateNeeded').value)$('dateNeeded').value=new Date().toISOString().slice(0,10);
  const summary=$('assetRequestSummary');
  summary.replaceChildren(el('span','eyebrow','Selected inventory asset'),el('strong','',a.ResourceName||'Unnamed resource'),el('span','',`${a.NIMS_Category||'Unclassified'} · ${a.NIMS_Kind||'Unknown kind'} · ${a.TypeClass||'Unspecified'} · ${a.SiteName||'No site'} · ${a.Status||'Unknown'} · Available quantity ${a.Quantity??0}`));
  $('requestError').hidden=true;
  $('requestEmptyState').hidden=true;
  $('requestForm').hidden=false;
  $('requestTitle').focus();
}
function clearRequestPane() {
  state.selected=null;
  state.selectionHighlight?.remove();
  state.selectionHighlight=null;
  $('requestForm').reset();
  $('requestForm').hidden=true;
  $('requestEmptyState').hidden=false;
  $('requestError').hidden=true;
  renderResources();
}
function renderRequests() { const list=$('requestList'); list.replaceChildren(); $('requestCount').textContent=state.requests.length; for(const r of state.requests){const a=attrs(r);const row=el('li','request-row');const h=document.createElement('header');h.append(el('strong','',a.RequestTitle||'Untitled request'),el('span',`status ${statusClass(a.IntegrationState)}`,a.IntegrationState||'Unknown'));row.append(h,el('p','',`${a.RequestStatus||'Unknown'} · Job ${a.WFMJobId||'NOT LINKED'}\n${a.IntegrationError||''}`));list.append(row);} if(!state.requests.length)list.append(el('li','empty-state','No resource requests have been submitted.')); }
function toggleDrawer(open){$('requestsDrawer').classList.toggle('open',open);$('drawerBackdrop').classList.toggle('open',open);$('requestsDrawer').setAttribute('aria-hidden',String(!open));}

async function setupArcGIS() {
  const cfg=state.config; window.require(['esri/WebMap','esri/views/MapView','esri/config','esri/identity/IdentityManager','esri/identity/OAuthInfo','esri/widgets/LayerList','esri/widgets/BasemapGallery','esri/widgets/Bookmarks','esri/widgets/Home','esri/widgets/Legend','esri/widgets/Expand'], async (WebMap,MapView,esriConfig,IdentityManager,OAuthInfo,LayerList,BasemapGallery,Bookmarks,Home,Legend,Expand)=>{
    esriConfig.portalUrl=cfg.portalUrl;
    if(cfg.oauthClientId && !cfg.oauthClientId.startsWith('NEW_')) IdentityManager.registerOAuthInfos([new OAuthInfo({appId:cfg.oauthClientId,portalUrl:cfg.portalUrl,popup:true,flowType:'implicit',popupCallbackUrl:`${location.origin}${location.pathname.replace(/[^/]*$/,'')}oauth-callback.html`})]);

    const showSignedOut=()=>{
      state.user=null;
      $('sessionUser').textContent='Not signed in'; $('sessionButton').textContent='Sign in'; $('sessionDot').classList.remove('online');
      setStatus('Sign-in required',true); $('lastUpdated').textContent='ArcGIS session required';
      $('mapMessage').hidden=false; $('mapMessage').querySelector('h2').textContent='Sign in required';
      $('mapMessage').querySelector('p').textContent='Sign in with your ArcGIS organization account to load the private operations map and resource data.';
    };
    const buildMap=async()=>{
      setStatus('Loading'); $('mapMessage').hidden=false; $('mapMessage').querySelector('h2').textContent='Operations Map'; $('mapMessage').querySelector('p').textContent='Loading secured ArcGIS content…';
      const map=new WebMap({portalItem:{id:cfg.webmapId}}); const view=new MapView({container:'mapView',map,ui:{components:['zoom','compass','attribution']}}); state.view=view; window.__esriView=view;window.__esriMap=map;window.__esriLayers={};window.__esriWidgets={};
      try{await view.when();const widgets={home:new Home({view}),layers:new Expand({view,content:new LayerList({view}),group:'map-tools',expanded:false,icon:'layers',tooltip:'Layers'}),basemap:new Expand({view,content:new BasemapGallery({view}),group:'map-tools',expanded:false,icon:'basemap',tooltip:'Basemap'}),bookmarks:new Expand({view,content:new Bookmarks({view}),group:'map-tools',expanded:false,icon:'bookmark',tooltip:'Bookmarks'}),legend:new Expand({view,content:new Legend({view}),group:'map-tools',expanded:false,icon:'legend',tooltip:'Legend'})};view.ui.add(widgets.home,'top-left');view.ui.add([widgets.layers,widgets.basemap,widgets.bookmarks,widgets.legend],'top-right');window.__esriWidgets=widgets;$('mapMessage').hidden=true; const layers=map.allLayers.toArray(); for(const l of layers)window.__esriLayers[l.title]=l; const resource=layers.find(l=>l.title==='Resources')||layers[0]; state.resourceLayer=resource; const facilitiesLayer=layers.find(l=>l.title==='Facilities'); await Promise.all([resource?.load(),facilitiesLayer?.load()].filter(Boolean));if(resource&&state.config.layerVisibility?.resources===false)resource.visible=false;if(facilitiesLayer&&state.config.layerVisibility?.facilities===false)facilitiesLayer.visible=false; if(resource){const q=resource.createQuery();q.where='1=1';q.outFields=['*'];q.returnGeometry=true;state.resources=(await resource.queryFeatures(q)).features;view.on('click',async event=>{const hit=await view.hitTest(event,{include:[resource]});const selected=hit.results.find(result=>result.graphic?.layer===resource)?.graphic;if(selected){const oidField=resource.objectIdField;const match=state.resources.find(feature=>attrs(feature)[oidField]===attrs(selected)[oidField])||selected;selectResource(match);}});} const facilities=layers.find(l=>l.title==='Facilities'); $('facilityTotal').textContent=facilities?await facilities.queryFeatureCount():0; $('resourceTotal').textContent=state.resources.length;$('availableTotal').textContent=state.resources.filter(r=>attrs(r).Status==='Available').length; buildChecks('statusFilters','Status',unique('Status'));buildChecks('categoryFilters','NIMS_Category',unique('NIMS_Category'));buildChecks('typingFilters','NIMS_Kind',[...new Set([...unique('NIMS_Kind'),...unique('TypeClass')])]);renderResources();await loadRequests();setStatus('Operational');$('lastUpdated').textContent=`Updated ${new Date().toLocaleTimeString()}`;}catch(e){$('mapMessage').hidden=false;$('mapMessage').querySelector('p').textContent=e.message;setStatus('Content unavailable',true);}
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
async function setUser(credential, IdentityManager){const response=await fetch(`${state.config.portalUrl}/sharing/rest/community/self?f=json&token=${encodeURIComponent(credential.token)}`);state.user=await response.json();if(state.user.error)throw new Error(state.user.error.message);state.user.credential=credential;const serviceOrigin=new URL(state.config.featureServiceUrl).origin;IdentityManager.registerToken({server:serviceOrigin,token:credential.token,expires:credential.expires,userId:state.user.username,ssl:true});$('sessionUser').textContent=state.user.fullName||state.user.username;$('sessionButton').textContent=state.config.labels?.signOutButton||'Sign out';$('sessionDot').classList.add('online');}
async function layerRequest(url, params){const body=new URLSearchParams({f:'json',...params});const response=await fetch(url,{method:'POST',body});const json=await response.json();if(json.error)throw new Error(json.error.message);return json;}
function requestExtendedProperties(a){return {'resource_request.globalid':a.GlobalID,'resource_request.request_title':a.RequestTitle,'resource_request.requested_category':a.RequestedCategory,'resource_request.requested_kind':a.RequestedKind,'resource_request.requested_type':a.RequestedType,'resource_request.quantity_requested':a.QuantityRequested,'resource_request.priority':a.Priority,'resource_request.incident_name':a.IncidentName,'resource_request.request_status':a.RequestStatus||'Submitted','resource_request.denial_reason':a.DenialReason||''};}
async function loadRequests(){if(!state.user?.credential?.token){state.requests=[];renderRequests();return;}try{const result=await layerRequest(`${state.config.featureServiceUrl}/${state.config.layers.requests}/query`,{where:"RequestStatus IS NULL OR RequestStatus <> 'Closed'",outFields:'*',orderByFields:'OBJECTID DESC',returnGeometry:'false',token:state.user.credential.token});state.requests=result.features||[];$('lastUpdated').textContent=`Updated ${new Date().toLocaleTimeString()}`;}catch(e){console.warn('Request refresh failed',e);if(!state.requests.length)state.requests=[];}renderRequests();}
async function submitRequest(event){event.preventDefault();if(!state.user)return toast('Sign in before submitting a request.','error');const submit=$('submitRequest');submit.disabled=true;$('requestError').hidden=true;const attributes=Object.fromEntries(new FormData(event.currentTarget));attributes.QuantityRequested=Number(attributes.QuantityRequested);attributes.DateNeeded=new Date(`${attributes.DateNeeded}T12:00:00`).getTime();
  const location=$('resourceLocation').value.trim();
  if(location&&location!=='Location not recorded'){const line=`Current resource location: ${location}`;attributes.Notes=[line,attributes.Notes].filter(Boolean).join('\n\n').slice(0,4000);}
  try{const token=state.user?.credential?.token; if(!token)throw new Error('A current ArcGIS credential is required.'); const table=`${state.config.featureServiceUrl}/${state.config.layers.requests}`;
    const workflow=new WorkflowClient({baseUrl:workflowBaseUrl(state.config),getToken:async()=>token,getUsername:async()=>state.user?.username||''});
    const updateRequest=async attributes=>{const updated=await layerRequest(`${table}/updateFeatures`,{features:JSON.stringify([{attributes}]),token});if(!updated.updateResults?.[0]?.success)throw new Error(updated.updateResults?.[0]?.error?.description||'Request update was not acknowledged.');};
    const readRequest=async oid=>{const read=await layerRequest(`${table}/query`,{objectIds:String(oid),outFields:'*',returnGeometry:'false',token});return read.features?.[0]?.attributes;};
    const result=await createLinkedRequest({attributes,
      createRequest:async a=>{const added=await layerRequest(`${table}/addFeatures`,{features:JSON.stringify([{attributes:a}]),token});const oid=added.addResults?.[0]?.objectId;if(!oid)throw new Error('Feature creation was not acknowledged.');const created=await readRequest(oid);if(!created)throw new Error('The submitted request could not be read back.');state.requests=[{attributes:created},...state.requests.filter(r=>attrs(r).OBJECTID!==created.OBJECTID)];renderRequests();toast(`Request ${oid} submitted and added to the requests list.`,'success');return created;},
      findJobsByRequestGlobalId:async globalId=>workflow.findJobsByExtendedProperty('resource_request.globalid',globalId),
      createJob:async request=>workflow.createJob(state.config.workflow.jobTemplateId,{name:request.RequestTitle||`Resource Request ${request.OBJECTID}`,extendedProperties:requestExtendedProperties(request)}),
      verifyJob:async(jobId,globalId)=>{const job=await workflow.getJob(jobId);const linked=jobExtendedProperty(job,'resource_request.globalid');if(text(linked).toLowerCase()!==text(globalId).toLowerCase())throw new Error('Workflow job correlation could not be verified.');},
      linkRequest:async(oid,jobId)=>updateRequest({OBJECTID:oid,WFMJobId:jobId,IntegrationState:'Linked',IntegrationError:'',LastWorkflowSync:Date.now()}),
      verifyRequestLink:async(oid,jobId)=>{const request=await readRequest(oid);if(request?.WFMJobId!==jobId||request?.IntegrationState!=='Linked')throw new Error('Request/job linkage could not be verified.');},
      markRequest:async(oid,integrationState,error)=>updateRequest({OBJECTID:oid,IntegrationState:integrationState,IntegrationError:text(error).slice(0,2000),LastWorkflowSync:Date.now()}),
      addAuditComment:async(jobId,info)=>workflow.addComment(jobId,`Resource request linked. OBJECTID ${info.objectId}; GlobalID ${info.globalId}; correlation ${info.correlationId}.`)
    }); toast(`Request ${result.request.OBJECTID} linked to job ${result.jobId}`,'success');clearRequestPane();await loadRequests();}catch(e){$('requestError').textContent=e.message;$('requestError').hidden=false;toast(e.message,'error');await loadRequests();}finally{submit.disabled=false;}}

async function init(){try{state.config=await loadConfig();applyPresentation(state.config);setupArcGIS();}catch(e){setStatus('Not configured',true);$('mapMessage').querySelector('p').textContent=e.message;}
  $('resourceSearch').addEventListener('input',renderResources);$('clearFilters').onclick=()=>{document.querySelectorAll('.check input').forEach(n=>n.checked=false);$('resourceSearch').value='';renderResources();};$('requestsButton').onclick=()=>toggleDrawer(true);$('closeDrawer').onclick=()=>toggleDrawer(false);$('drawerBackdrop').onclick=()=>toggleDrawer(false);$('cancelRequest').onclick=clearRequestPane;$('closeRequestPane').onclick=clearRequestPane;$('requestForm').addEventListener('submit',submitRequest);const notes=$('requestNotes');const sizeNotes=()=>{notes.style.height='auto';notes.style.height=`${Math.max(120,notes.scrollHeight)}px`;};notes.addEventListener('input',sizeNotes);sizeNotes();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user)loadRequests();});state.requestPoll=setInterval(()=>{if(!document.hidden&&state.user)loadRequests();},30000);renderRequests();}
init();
