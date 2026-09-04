/**
 * Currency, date, and percentage formatters for RecoverOS
 */

export function formatINR(amount = 0) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatShortINR(amount = 0) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export function formatTimeAgo(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date('2026-09-04T12:00:00.000Z');
  const elapsedSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (elapsedSec < 60) return `${Math.max(1, elapsedSec)}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}
