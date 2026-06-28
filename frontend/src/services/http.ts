import axios from 'axios'
import { jwtDecode } from 'jwt-decode'
import { BASE_URL } from '../utils/base'
import { errorNotification } from '../components/ui/Toast';
import { EXEMPTED_TOKEN_ROUTES } from '../routes/config';
import { useAuthStore } from '../stores/authStore';


// Create an Axios instance
const http = axios.create({
  baseURL: BASE_URL,
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

    // Extract subdomain from hostname for X-Client-Domain header
    const hostname = window.location.hostname;
    let subdomain = null;

    // Handle different hostname formats
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const parts = hostname.split('.');
      if (parts.length > 2) {
        subdomain = parts[0]; // e.g., 'nobody' from 'nobody.safaridesk.io'
      }
    } else {
      // For localhost, try to extract from hostname like 'nobody.localhost'
      const parts = hostname.split('.');
      if (parts.length > 1) {
        subdomain = parts[0];
      }
    }

    const isPublic = isPublicRoute(config.url || '');

    // Add X-Client-Domain header if subdomain exists
    if (subdomain) {
      config.headers['X-Client-Domain'] = subdomain;
    }

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
            // BASE_URL already includes the /api/v1 prefix — don't double it up.
            const response = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
              refresh: refreshToken
            });

            const newToken = response.data.access;
            localStorage.setItem('token', newToken);

            // Update tokens in auth store
            const { setTokens, fetchCurrentUserProfile } = useAuthStore.getState();
            setTokens(newToken, refreshToken);

            // Fetch fresh user profile data from backend (avatar and other user-specific data)
            await fetchCurrentUserProfile();

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
