/**
 * Formats an ISO date string into human-readable relative time
 */
export function formatRelativeTime(isoString) {
  if (!isoString) {
    return "Check pending";
  }

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0 || isNaN(diffMs)) {
    return "Checked just now";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) {
    return "Checked just now";
  }
  if (diffMin < 60) {
    return diffMin === 1 ? "Checked 1 minute ago" : `Checked ${diffMin} minutes ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "Checked 1 hour ago" : `Checked ${diffHours} hours ago`;
  }
  if (diffDays === 1) {
    return "Checked yesterday";
  }
  return `Checked ${diffDays} days ago`;
}
