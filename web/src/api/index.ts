export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || (window.location.port === '5173' ? 'http://localhost:5000' : '');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!BACKEND_URL) return cleanPath;
  return `${BACKEND_URL.replace(/\/+$/, '')}${cleanPath}`;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = getApiUrl(path);
  const token = localStorage.getItem('zena_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.detail || `Request failed with status ${response.status}`);
  }

  return data;
}
