const text = value => value == null ? '' : String(value).trim();

export function normalizeGlobalId(value) {
  return text(value).replace(/[{}]/g, '').toLowerCase();
}

export function requestDeploymentLocation(requestAttributes = {}) {
  const x = Number(requestAttributes.DeploymentLongitude);
  const y = Number(requestAttributes.DeploymentLatitude);
  const location = {
    facilityGlobalId: text(requestAttributes.DestinationFacilityGlobalID),
    siteName: text(requestAttributes.DeploymentSiteName),
    address: text(requestAttributes.DeploymentAddress),
    geometry: Number.isFinite(x) && Number.isFinite(y) ? { x, y, spatialReference: { wkid: 4326 } } : null
  };
  return Number.isFinite(x) && Number.isFinite(y) && Boolean(location.siteName || location.address) ? location : null;
}

export function deploymentLocationAttributes(location) {
  return {
    DestinationFacilityGlobalID: text(location?.facilityGlobalId),
    DeploymentSiteName: text(location?.siteName),
    DeploymentAddress: text(location?.address),
    DeploymentLongitude: Number(location?.geometry?.x),
    DeploymentLatitude: Number(location?.geometry?.y)
  };
}

export function resourceOriginLocation(resource, facilities = [], toFacilityLocation = feature => feature) {
  const attributes = resource?.attributes || {};
  const requestedFacilityId = text(attributes.CurrentFacilityGlobalID || attributes.HomeFacilityGlobalID);
  const matchedFacility = requestedFacilityId
    ? facilities.find(feature => normalizeGlobalId(feature?.attributes?.GlobalID || feature?.attributes?.globalid) === normalizeGlobalId(requestedFacilityId))
    : null;
  const facility = matchedFacility ? toFacilityLocation(matchedFacility) : {};
  const resourceX = Number(resource?.geometry?.x), resourceY = Number(resource?.geometry?.y);
  const homeX = Number(attributes.HomeX), homeY = Number(attributes.HomeY);
  const hasResourcePoint = Number.isFinite(resourceX) && Number.isFinite(resourceY);
  const hasFacilityPoint = Number.isFinite(Number(facility?.geometry?.x)) && Number.isFinite(Number(facility?.geometry?.y));
  const hasHomePoint = text(attributes.HomeX) !== '' && text(attributes.HomeY) !== '' && Number.isFinite(homeX) && Number.isFinite(homeY);
  const geometry = hasResourcePoint
    ? { x: resourceX, y: resourceY, spatialReference: { wkid: Number(resource.geometry?.spatialReference?.latestWkid || resource.geometry?.spatialReference?.wkid || 4326) } }
    : hasFacilityPoint
      ? facility.geometry
      : hasHomePoint
        ? { x: homeX, y: homeY, spatialReference: { wkid: Number(attributes.HomeWKID || 4326) } }
        : null;
  return {
    matchedFacility,
    location: {
      facilityGlobalId: text(facility?.facilityGlobalId || requestedFacilityId),
      siteName: text(attributes.SiteName || attributes.HomeSiteName || facility?.siteName || attributes.CurrentAddress || attributes.HomeAddress || facility?.address),
      address: text(attributes.CurrentAddress || attributes.HomeAddress || facility?.address),
      geometry
    }
  };
}
