import { buildMovement, buildResourceUpdate, guid, movementForStep, rollbackResourceUpdate } from './resource-movement.js';

function requestUpdate(request, movement, state, error = '', returnedDate) {
  return { attributes: {
    OBJECTID: request.attributes.OBJECTID,
    GlobalID: request.attributes.GlobalID,
    MovementGlobalID: movement.attributes.GlobalID,
    DeploymentSiteName: movement.attributes.ToSiteName,
    DeploymentAddress: movement.attributes.DeploymentAddress,
    DeploymentLongitude: movement.attributes.ToX,
    DeploymentLatitude: movement.attributes.ToY,
    DestinationFacilityGlobalID: movement.attributes.ToFacilityGlobalID,
    LocationUpdateState: state,
    LocationUpdateError: error,
    ...(returnedDate ? { ReturnedDate: returnedDate } : {})
  }};
}

export async function executeMovementSaga({ client, layers, workflow, request, step, action, note, location, username, now = Date.now, movementGlobalId = guid() }) {
  const rule = movementForStep(step.stepName);
  if (!rule) throw new Error(`The ${step.stepName} step does not define a geometry movement.`);
  const resource = await client.oneByGlobalId(layers.resources, request.attributes.ResourceGlobalID, { outFields: '*', returnGeometry: true, outSpatialReference: 4326 });
  const before = structuredClone(resource);
  const idempotencyKey = `${request.attributes.WFMJobId}:${step.stepId}:${request.attributes.ResourceGlobalID}:${rule.type}`;
  const escapedKey = idempotencyKey.replace(/'/g, "''");
  const priorRows = await client.query(layers.movements, { where: `IdempotencyKey='${escapedKey}'`, outFields: '*', returnGeometry: true, outSpatialReference: 4326 });
  if (priorRows.length > 1) throw new Error('Multiple movement audit records share this workflow action. Reconciliation is required.');
  const prior = priorRows[0];
  const priorState = prior?.attributes?.MovementState;
  if (priorState === 'Confirmed') throw new Error('This resource movement is already confirmed. Refresh the workflow queue.');
  if (priorState === 'ReconcileRequired') throw new Error(`The previous ${rule.type.toLowerCase()} attempt requires reconciliation before retrying.`);
  const effectiveMovementGlobalId = prior?.attributes?.GlobalID || movementGlobalId;
  const resumed = priorState === 'Applied';
  let movement, resourceEdit, edited;
  if (resumed) {
    const expectedX=Number(prior.attributes.ToX),expectedY=Number(prior.attributes.ToY);
    const actualX=Number(resource.geometry?.x),actualY=Number(resource.geometry?.y);
    if (![expectedX,expectedY,actualX,actualY].every(Number.isFinite)||Math.abs(expectedX-actualX)>1e-6||Math.abs(expectedY-actualY)>1e-6) {
      const message=`The previous ${rule.type.toLowerCase()} GIS edit is Applied, but the resource no longer matches its destination. Reconciliation is required.`;
      await client.applyServiceEdits([
        { id: layers.requests, updates: [requestUpdate(request, prior, 'ReconcileRequired', message)] },
        { id: layers.movements, updates: [{ attributes: { GlobalID: effectiveMovementGlobalId, MovementState: 'ReconcileRequired', IntegrationError: message } }] }
      ]);
      const error=new Error(message);error.reconcileRequired=true;throw error;
    }
    movement=prior;edited=resource;
  } else {
    movement = buildMovement({ movementGlobalId: effectiveMovementGlobalId, request, resource, step, location, username, now: now() });
    resourceEdit = buildResourceUpdate(resource, movement, step.stepName);
    const requestEdit = requestUpdate(request, movement, 'Applied');
    const movementEdit = prior ? { updates: [movement] } : { adds: [movement] };
    await client.applyServiceEdits([
      { id: layers.resources, updates: [resourceEdit] },
      { id: layers.requests, updates: [requestEdit] },
      { id: layers.movements, ...movementEdit }
    ]);
    edited = await client.oneByGlobalId(layers.resources, request.attributes.ResourceGlobalID, { outFields: '*', returnGeometry: true, outSpatialReference: 4326 });
    if (Number(edited.attributes.LocationVersion) !== Number(resourceEdit.attributes.LocationVersion)) throw new Error('Resource location read-back verification failed.');
  }

  try {
    if (action.mode === 'finish') await workflow.finishStep(request.attributes.WFMJobId, step.stepId);
    else await workflow.completeStep(request.attributes.WFMJobId, step.stepId, action.response, note);
  } catch (workflowError) {
    if (resumed) {
      await client.applyServiceEdits([
        { id: layers.requests, updates: [requestUpdate(request, movement, 'Applied', workflowError.message)] },
        { id: layers.movements, updates: [{ attributes: { GlobalID: effectiveMovementGlobalId, MovementState: 'Applied', IntegrationError: workflowError.message } }] }
      ]).catch(() => undefined);
      throw workflowError;
    }
    const current = await client.oneByGlobalId(layers.resources, request.attributes.ResourceGlobalID, { outFields: '*', returnGeometry: true, outSpatialReference: 4326 });
    if (Number(current.attributes.LocationVersion) !== Number(resourceEdit.attributes.LocationVersion)) {
      const message = `Workflow failed after the GIS edit and the resource changed again: ${workflowError.message}`;
      await client.applyServiceEdits([
        { id: layers.requests, updates: [requestUpdate(request, movement, 'ReconcileRequired', message)] },
        { id: layers.movements, updates: [{ attributes: { GlobalID: effectiveMovementGlobalId, MovementState: 'ReconcileRequired', IntegrationError: message } }] }
      ]);
      const error = new Error(message); error.reconcileRequired = true; throw error;
    }
    const rollback = rollbackResourceUpdate(before, resourceEdit.attributes.OBJECTID, Number(resourceEdit.attributes.LocationVersion) + 1);
    await client.applyServiceEdits([
      { id: layers.resources, updates: [rollback] },
      { id: layers.requests, updates: [requestUpdate(request, movement, 'Reverted', workflowError.message)] },
      { id: layers.movements, updates: [{ attributes: { GlobalID: effectiveMovementGlobalId, MovementState: 'Reverted', IntegrationError: workflowError.message } }] }
    ]);
    throw workflowError;
  }

  const confirmedAt = now();
  try {
    await client.applyServiceEdits([
      { id: layers.requests, updates: [requestUpdate(request, movement, 'Confirmed', '', rule.type === 'Return' ? confirmedAt : undefined)] },
      { id: layers.movements, updates: [{ attributes: { GlobalID: effectiveMovementGlobalId, MovementState: 'Confirmed', ConfirmedDate: confirmedAt } }] }
    ]);
    await workflow.addComment(request.attributes.WFMJobId, `${note}\nMovement ${effectiveMovementGlobalId}: ${movement.attributes.FromSiteName || 'previous location'} → ${movement.attributes.ToSiteName}${movement.attributes.DeploymentAddress ? ` (${movement.attributes.DeploymentAddress})` : ''}.`);
  } catch (error) {
    const message = `Workflow advanced and resource moved, but movement confirmation needs reconciliation: ${error.message}`;
    await client.applyServiceEdits([{ id: layers.requests, updates: [requestUpdate(request, movement, 'ReconcileRequired', message)] }]).catch(() => undefined);
    const wrapped = new Error(message); wrapped.reconcileRequired = true; throw wrapped;
  }
  return { movement, resource: edited };
}
