const token=process.env.ARCCTL_TOKEN;if(!token)throw new Error('ARCCTL_TOKEN required');
const url='https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/admin/services/Resource_Asset_Management_20261028/FeatureServer/addToDefinition';
const str=(name,alias,length,domain)=>({name,alias,type:'esriFieldTypeString',sqlType:'sqlTypeNVarchar',length,nullable:true,editable:true,defaultValue:null,...(domain?{domain:{type:'codedValue',name:`${name}_domain`,codedValues:domain.map(code=>({name:code,code}))}}:{})});
const table={id:2,name:'ResourceRequests',type:'Table',displayField:'RequestTitle',description:'Workflow-linked ICS 213RR resource request read model.',objectIdField:'OBJECTID',globalIdField:'GlobalID',fields:[
{name:'OBJECTID',alias:'OBJECTID',type:'esriFieldTypeOID',sqlType:'sqlTypeInteger',nullable:false,editable:false},
{name:'GlobalID',alias:'GlobalID',type:'esriFieldTypeGlobalID',sqlType:'sqlTypeOther',length:38,nullable:false,editable:false},
str('RequestTitle','Request Title',200),str('RequestedCategory','Requested Category',100),str('RequestedKind','Requested Kind',100),str('RequestedType','Requested Type',50),
{name:'QuantityRequested',alias:'Quantity Requested',type:'esriFieldTypeInteger',sqlType:'sqlTypeInteger',nullable:true,editable:true},
str('Priority','Priority',30),str('Requestor','Requestor',150),str('IncidentName','Incident Name',150),
{name:'DateNeeded',alias:'Date Needed',type:'esriFieldTypeDate',sqlType:'sqlTypeTimestamp2',nullable:true,editable:true},
str('RequestStatus','Request Status',30),str('ResourceGlobalID','Resource GlobalID',38),str('Notes','Notes',4000),str('ApprovedBy','Approved By',150),
{name:'ApprovedDate',alias:'Approved Date',type:'esriFieldTypeDate',sqlType:'sqlTypeTimestamp2',nullable:true,editable:true},
{name:'ReturnedDate',alias:'Returned Date',type:'esriFieldTypeDate',sqlType:'sqlTypeTimestamp2',nullable:true,editable:true},
str('StatusBadge','Status Badge',50),str('WFMJobId','Workflow Manager Job ID',100),str('DenialReason','Denial Reason',4000),
str('IntegrationState','Integration State',30,['Pending','Linked','Failed','ReconcileRequired']),str('IntegrationError','Integration Error',2000),
{name:'LastWorkflowSync',alias:'Last Workflow Sync',type:'esriFieldTypeDate',sqlType:'sqlTypeTimestamp2',nullable:true,editable:true}
],indexes:[{name:'WFMJobId_IDX',fields:'WFMJobId',isAscending:true,isUnique:false},{name:'GlobalID_IDX',fields:'GlobalID',isAscending:true,isUnique:true}]};
const body=new URLSearchParams({f:'json',token,addToDefinition:JSON.stringify({tables:[table]})});const r=await fetch(url,{method:'POST',body});const j=await r.json();if(!r.ok||j.error||j.success!==true)throw new Error(j.error?.message||JSON.stringify(j));console.log(JSON.stringify(j));