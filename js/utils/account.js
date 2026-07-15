function cleanName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function accountDisplayName(cloud = {}) {
  if (!cloud.signedIn) return '';
  const user = cloud.user || {};
  const member = (cloud.familyMembers || []).find((item) => item.user_id === user.id);
  const candidates = [
    cloud.family?.display_name,
    member?.display_name,
    user.user_metadata?.display_name,
    user.user_metadata?.full_name,
    user.user_metadata?.name
  ];
  return candidates.map(cleanName).find(Boolean) || '';
}

export function personalizedGreeting(salutation, displayName = '') {
  const greeting = cleanName(salutation) || 'Hallo';
  const name = cleanName(displayName);
  return name ? `${greeting}, ${name}.` : `${greeting}.`;
}
