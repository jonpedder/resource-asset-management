export function redactCredential(credential) {
  return credential ? { userId: credential.userId, expires: credential.expires } : null;
}

export function requireCredential(credential) {
  if (!credential?.token) throw new Error('An authenticated ArcGIS user session is required.');
  return credential;
}
