import axios from 'axios'
import { jwtDecode } from 'jwt-decode'
import { BASE_URL } from '../utils/base'
import { errorNotification } from '../components/ui/Toast';
import { EXEMPTED_TOKEN_ROUTES } from '../routes/config';
import { useAuthStore } from '../stores/authStore';


// Create an Axios instance. No `baseURL` here: every entry in APIS (services/apis.ts)
// already embeds BASE_URL itself, so setting it here too doubled every single request
// path to /api/v1/api/v1/... in the production build. Call sites that pass a bare
// relative path (not through an APIS.* constant) must include BASE_URL themselves.
const http = axios.create({
  timeout: 20000,
})

interface DecodedToken {
  exp: number
  [key: string]: string | number | boolean
}

const isTokenValid = (token: string): boolean => {
  if (!token) return false
  try {
    const decodedToken = jwtDecode<DecodedToken>(token)
    const currentTime = Math.floor(Date.now() / 1000)
    return decodedToken.exp > currentTime
  } catch (e) {
    console.error('Token decoding error:', e)
    return false
  }
}

// Check if a URL matches public routes (including dynamic segments)
const isPublicRoute = (url: string): boolean => {
  let pathname = url;
  try {
    const requestUrl = new URL(url, BASE_URL);
    const basePath = new URL(BASE_URL).pathname.replace(/\/$/, '');
    pathname = requestUrl.pathname;
    if (basePath && basePath !== '/' && pathname.startsWith(`${basePath}/`)) {
      pathname = pathname.slice(basePath.length);
    }
  } catch {
    // Fall back to the raw url below.
  }

  if (EXEMPTED_TOKEN_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    return true;
  }

  // Check for customer ticket route pattern (matches /customer/ticket/TICKETID)
  // This will match patterns like: /customer/ticket/INCE34FAB
  const ticketRoutePattern = /\/customer\/ticket\/[A-Z0-9]+\/?$/i;
  return ticketRoutePattern.test(pathname);
}

// Request interceptor
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const skipAuth = Boolean((config as any).skipAuth || config.headers?.['X-Skip-Auth']);

    if (config.headers?.['X-Skip-Auth']) {
      delete config.headers['X-Skip-Auth'];
    }

    // Tenant is resolved server-side from the real Host header by
    // CustomDomainMiddleware — the backend never reads a client-sent domain
    // header, so no X-Client-Domain is derived or sent here.
    const isPublic = isPublicRoute(config.url || '');

    if (token && !isPublic && !skipAuth) {
      if (isTokenValid(token)) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        errorNotification('Session expired');
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return config
  },
  (error) => {
    errorNotification(error)
    return Promise.reject(error)
  },
)

// Single-flight guard: if N requests 401 at once (e.g. right after token expiry),
// only the first triggers an actual refresh call. The rest await the same promise
// instead of each spending the refresh token — if the backend rotates refresh
// tokens on use, concurrent independent calls would invalidate each other and log
// out a session that was actually still valid.
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = (refreshToken: string): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/token/refresh/`, { refresh: refreshToken })
      .then(async (response) => {
        const newToken = response.data.access;
        localStorage.setItem('token', newToken);

        const { setTokens, fetchCurrentUserProfile } = useAuthStore.getState();
        setTokens(newToken, refreshToken);
        await fetchCurrentUserProfile();

        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Response interceptor
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.code === 'ECONNABORTED') {
      errorNotification('Request timeout error: ' + error.message)
    }

    // Handle 401 errors (Unauthorized)
    if (error.response && error.response.status === 401) {
      // Prevent infinite loop
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        const refreshToken = localStorage.getItem('refresh');

        // Try to refresh the token
        if (refreshToken) {
          try {
            const newToken = await refreshAccessToken(refreshToken);

            // Retry the original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return http(originalRequest);
          } catch {
            // Refresh failed, logout user
            errorNotification('Session expired. Please login again.');
            await handleLogout();
          }
        } else {
          // No refresh token, logout immediately
          await handleLogout();
        }
      }
    }

    return Promise.reject(error)
  },
)

const handleLogout = async () => {
  const { logout } = useAuthStore.getState();
  logout(); // clears localStorage tokens + resets Zustand auth state
  window.location.href = '/auth'
}

export default http
