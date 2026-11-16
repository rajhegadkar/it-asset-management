import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const ACCESS_KEY = 'itam_access_token';
export const REFRESH_KEY = 'itam_refresh_token';
export const USER_KEY = 'itam_user';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

// Request interceptor to inject JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// One refresh at a time; parallel 401s wait for the same refresh
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    // plain axios: must not go through the interceptors below
    const res = await axios.post('/api/v1/auth/refresh-token', { refreshToken });
    const { accessToken, refreshToken: next } = res.data?.data || {};
    if (!accessToken) return null;
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (next) localStorage.setItem(REFRESH_KEY, next);
    return accessToken;
  } catch {
    return null;
  }
}

function goToLogin() {
  clearSession();
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

// Response interceptor: on an expired access token, refresh once and retry the request
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    // Validation errors: put the field-level reasons into the message every screen already shows,
    // e.g. "Custom field validation failed: Business Criticality must be one of: …"
    const body = error.response?.data;
    if (body && Array.isArray(body.errors) && body.errors.length && typeof body.message === 'string' && !body._detailed) {
      const details = body.errors.map((e: any) => e?.message).filter(Boolean).slice(0, 3).join('; ');
      if (details) body.message = `${body.message}: ${details}`;
      body._detailed = true;
    }
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 401 && original && !original._retried && !original.url?.includes('/auth/login')) {
      original._retried = true;
      if (!refreshing) refreshing = refreshAccessToken().finally(() => (refreshing = null));
      const newToken = await refreshing;
      if (newToken) {
        original.headers = original.headers || ({} as any);
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      goToLogin();
    } else if (status === 401 && !original?.url?.includes('/auth/login')) {
      goToLogin();
    } else if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
      // Session belongs to an account that must set a new password first
      goToLogin();
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from an API error (falls back to the given text). */
export function apiErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (data instanceof Blob) return fallback;
  return data?.message || data?.error || fallback;
}
