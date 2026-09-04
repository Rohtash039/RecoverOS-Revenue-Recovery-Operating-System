import { CURRENCIES } from '../context/CurrencyContext';

function getActiveCurrencyConfig() {
  try {
    const saved = localStorage.getItem('recoveros_currency');
    if (saved && CURRENCIES[saved]) return CURRENCIES[saved];
  } catch {

  }
  return CURRENCIES.INR;
}

export function formatINR(amount = 0) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  const config = getActiveCurrencyConfig();
  const converted = amount * config.rate;

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: config.decimals
    }).format(converted);
  } catch {
    return `${config.symbol}${Math.round(converted).toLocaleString()}`;
  }
}

export function formatShortINR(amount = 0) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  const config = getActiveCurrencyConfig();
  const converted = amount * config.rate;

  if (config.code === 'INR') {
    if (converted >= 100000) {
      return `₹${(converted / 100000).toFixed(2)}L`;
    }
    if (converted >= 1000) {
      return `₹${(converted / 1000).toFixed(1)}k`;
    }
    return `₹${converted.toLocaleString('en-IN')}`;
  }

  if (converted >= 1000000) {
    return `${config.symbol}${(converted / 1000000).toFixed(2)}M`;
  }
  if (converted >= 1000) {
    return `${config.symbol}${(converted / 1000).toFixed(1)}k`;
  }
  return `${config.symbol}${Math.round(converted).toLocaleString()}`;
}

export function formatMoney(amount = 0) {
  return formatINR(amount);
}

export function formatShortMoney(amount = 0) {
  return formatShortINR(amount);
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

