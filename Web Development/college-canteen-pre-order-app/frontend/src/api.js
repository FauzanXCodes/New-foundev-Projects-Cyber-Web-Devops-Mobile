const pageHost = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const apiHost = pageHost.includes(':') && !pageHost.startsWith('[') ? `[${pageHost}]` : pageHost;
const base = import.meta.env.VITE_API_URL || `http://${apiHost}:4000/api`;

export async function api(path, options = {}) {
  const token = localStorage.getItem('campusbite-token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  let response;
  try { response = await fetch(`${base}${path}`, { ...options, headers }); }
  catch { throw new Error('Can’t reach Campus Bite. Check that the API and database are running.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

export const money = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
export const imageFallback = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80';
