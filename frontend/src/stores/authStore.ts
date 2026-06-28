import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import type { SessionUser } from '../types';
import { APIS } from '../services/apis';
import { jwtDecode } from 'jwt-decode'
import { queryClient } from '../services/queryClient';


interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isSessionReady: boolean;
  isLoading: boolean;
  error: string | null;
  message: string | null;
  sessionKey: string | null;
  workspace: Record<string, unknown> | null;
  success: boolean;
  linkSent: boolean;
  isStraight: boolean;
  hasPasswordReset: boolean;
  siteUrl: string | null;
  mfaMethod: string | null;  // 'email' | 'totp' | null

  url: string | null;

  // Actions
  setTokens: (access: string, refresh: string) => void;
  reconcileSession: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<string | undefined>;
  logout: () => void;
  updateUser: (userData: Partial<SessionUser>) => void;
  updateUserProfile: (userData: UserProfileUpdate) => void;
  fetchCurrentUserProfile: () => Promise<void>;
  updateBusiness: (businessData: Partial<SessionUser['business']>) => void;
  clearError: () => void;
  clearSuccess: () => void;
  verifyOTP: (otp: string) => Promise<void>;
  requestPasswordReset: (email: string, businessId?: number) => Promise<void>;
  resetPassword: (token: string, new_password: string, uid: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  cleanFlow: () => void;
}

interface RegisterData {
  email: string;
  firstName: string;
  lastName: string;
  business_name: string;
  subdomain: string;
  organization_size: string;
}

type UserProfileUpdate = Partial<Pick<
  SessionUser,
  'first_name' | 'last_name' | 'email' | 'phone_number' | 'avatar_url'
>>;


// API functions using axios
const apiLogin = async (username: string, password: string) => {
  const payload = {
    username,
    password,
  };

  const response = await axios.post(APIS.LOGIN, payload);
  return response.data;
};


const ApirequestPasswordReset = async (identifier: string, businessId?: number) => {
  const payload: { identifier: string; business_id?: number } = { identifier };
  if (businessId) {
    payload.business_id = businessId;
  }
  const response = await axios.post(APIS.REQUEST_RESET_PASSWORD, payload);
  return response.data;
};


const ApiResetPassword = async (token: string, new_password: string, uid: string) => {
  const payload = {
    token,
    new_password,
    uid,
  };
  const response = await axios.post(APIS.RESET_PASSWORD, payload);
  return response.data;
};

const decodeSessionUser = (token: string): SessionUser | null => {
  try {
    return jwtDecode<SessionUser>(token);
  } catch {
    return null;
  }
};

const isAccessTokenValid = (token: string | null): boolean => {
  if (!token) return false;

  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return typeof decoded.exp === 'number' && decoded.exp > currentTime;
  } catch {
    return false;
  }
};


export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      workspace: null,
      isAuthenticated: false,
      isSessionReady: false,
      isLoading: false,
      error: null,
      message: null,
      sessionKey: null,
      success: false,
      isStraight: false,
      linkSent: false,
      hasPasswordReset: false,
      siteUrl: null,
      mfaMethod: null,
      url: null,

      setTokens: (access: string, refresh: string) => {
        localStorage.setItem("token", access);
        if (refresh) {
          localStorage.setItem("refresh", refresh);
        }
        const user = decodeSessionUser(access);
        set({
          isAuthenticated: !!user,
          isSessionReady: true,
          user,
        });
      },

      reconcileSession: () => {
        const token = localStorage.getItem('token');
        const user = token ? decodeSessionUser(token) : null;

        if (token && isAccessTokenValid(token) && user) {
          set({
            user,
            isAuthenticated: true,
            isSessionReady: true,
          });
          return;
        }

        localStorage.removeItem('token');
        localStorage.removeItem('refresh');
        queryClient.clear();
        localStorage.removeItem('sd:query-cache');
        localStorage.removeItem('sd:knowledge-cache');
        set({
          user: null,
          isAuthenticated: false,
          isSessionReady: true,
        });
      },

      login: async (email: string, password: string) => {
        set({
          isLoading: true,
          error: null,
          success: false,
          sessionKey: null,
          mfaMethod: null,
          url: null,
        });

        // Clear any existing tokens/cache before login to prevent cross-user data leaks
        localStorage.removeItem('token');
        localStorage.removeItem('refresh');
        localStorage.removeItem('sd:query-cache');
        localStorage.removeItem('sd:knowledge-cache');

        try {
          const response = await apiLogin(email, password);

          // Check if MFA is required (based on backend response)
          if (response.mfa_required === false) {
            // No MFA - direct login
            localStorage.setItem("token", response.access);
            localStorage.setItem("refresh", response.refresh);
            const user: SessionUser = jwtDecode(response.access);

            set({
              isLoading: false,
              success: true,
              isAuthenticated: true,
              isSessionReady: true,
              user: user,
              isStraight: true,
              sessionKey: null,
              mfaMethod: null,
              url: 'dashboard',
            });
          } else {
            // MFA required - store session and route to appropriate verify page
            const mfaMethod = response.mfa_method || 'email';
            set({
              sessionKey: response.sessionKey,
              mfaMethod: mfaMethod,
              isLoading: false,
              success: true,
              isAuthenticated: false,
              url: mfaMethod === 'totp' ? 'totp-verify' : 'otp-verify',
            });
          }


        } catch (error: unknown) {
          let errorMessage = 'An unexpected error occurred';

          if (axios.isAxiosError(error)) {
            const responseData = error.response?.data;

            // Check for specific error messages from backend
            if (responseData?.message) {
              errorMessage = responseData.message;
            } else if (responseData?.detail) {
              errorMessage = responseData.detail;
            } else if (responseData?.error_code) {
              // Map error codes to user-friendly messages
              switch (responseData.error_code) {
                case 'invalid_username':
                  errorMessage = 'Invalid username. Please check and try again.';
                  break;
                case 'wrong_password':
                  errorMessage = 'Wrong password. Please try again.';
                  break;
                case 'account_disabled':
                  errorMessage = 'Your account has been disabled. Please contact support.';
                  break;
                default:
                  errorMessage = error.response?.data?.message || error.message;
              }
            } else {
              errorMessage = error.message;
            }
          }

          set({
            error: errorMessage,
            isLoading: false,
            success: false,
          });
        }
      },
      requestPasswordReset: async (identifier: string, businessId?: number) => {
        set({ isLoading: true, error: null });

        try {

          await ApirequestPasswordReset(identifier, businessId);
          set({
            isLoading: false,
            linkSent: true,
            // url: 'auth',
          });

        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : 'An unexpected error occurred';

          set({
            error: errorMessage,
            isLoading: false,
            linkSent: false,
          });
        }
      },

      resetPassword: async (token: string, new_password: string, uid: string) => {
        set({ isLoading: true, error: null });

        try {
          await ApiResetPassword(token, new_password, uid);

          set({
            isLoading: false,
            hasPasswordReset: true,
          });

        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : 'An unexpected error occurred';

          set({
            error: errorMessage,
            isLoading: false,
            hasPasswordReset: false,
          });
        }
      },

      register: async (userData: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          // Transform userData to match API payload format
          const payload = {
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            business_name: userData.business_name,
            domain: userData.subdomain,
            organization_size: userData.organization_size,
            website: "" // or provide a default/configurable website URL
          };

          const response = await axios.post(APIS.CREATE_BUSINESS, payload);

          // Handle register response based on your API structure
          set({
            isLoading: false,
            success: true,
            message: response.data.message,
            siteUrl: response.data.site_url,
          });
          return response.data;
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : 'An unexpected error occurred';

          set({
            error: errorMessage,
            isLoading: false,
          });
          return undefined;
        }
      },

      logout: () => {
        const accessToken = localStorage.getItem('token');
        const refreshToken = localStorage.getItem('refresh');
        if (accessToken && refreshToken) {
          void axios.post(
            APIS.LOGOUT,
            { refresh: refreshToken },
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ).catch(() => undefined);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refresh');
        // Clear all cached data so no PII leaks to the next user on a shared machine
        queryClient.clear();
        localStorage.removeItem('sd:query-cache');
        localStorage.removeItem('sd:knowledge-cache');
        set({
          user: null,
          workspace: null, // Clear workspace on logout
          isAuthenticated: false,
          isSessionReady: true,
          error: null,
          sessionKey: null,
          success: false,
          mfaMethod: null,
          url: null,
        });
      },

      updateUser: (userData: Partial<SessionUser>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...userData },
          });
        }
      },

      updateBusiness: (businessData: Partial<SessionUser['business']>) => {
        const { user } = get();
        if (user && user.business) {
          set({
            user: {
              ...user,
              business: {
                ...user.business,
                ...businessData,
              },
            },
          });
        }
      },

      updateUserProfile: (userData: UserProfileUpdate) => {
        const { user } = get();
        if (user) {
          const updatedUser = {
            ...user,
            first_name: userData.first_name || user.first_name,
            last_name: userData.last_name || user.last_name,
            email: userData.email || user.email,
            phone_number: userData.phone_number || user.phone_number,
            avatar_url: userData.avatar_url || user.avatar_url,
          };
          set({ user: updatedUser });

          // Also update the token in localStorage with new user data
          const token = localStorage.getItem('token');
          if (token) {
            localStorage.setItem('token', token);
          }
        }
      },

      verifyOTP: async (otp: string) => {
        set({ isLoading: true, error: null });

        try {
          const { sessionKey } = get(); // Get sessionKey from current state
          if (!sessionKey) {
            set({
              error: 'Login session expired. Please sign in again.',
              isLoading: false,
              success: false,
            });
            return;
          }

          const payload = {
            otp: otp,
            session_key: sessionKey
          };

          const response = await axios.post(APIS.VERIFY_OTP, payload);
          const { access, refresh } = response.data;
          localStorage.setItem("token", access);
          localStorage.setItem("refresh", refresh);

          const user: SessionUser = jwtDecode(access)

          set({
            isAuthenticated: true,
            isSessionReady: true,
            isLoading: false,
            success: true,
            user: user,
            sessionKey: null,
            mfaMethod: null,
            url: 'dashboard',
          });
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : 'An unexpected error occurred';

          set({
            error: errorMessage,
            isLoading: false,
            success: false,
          });
        }
      },
      resendOTP: async () => {
        try {
          const { sessionKey } = get();
          if (!sessionKey) {
            set({ error: 'Login session expired. Please sign in again.' });
            return;
          }

          const payload = {
            session_key: sessionKey
          };

          await axios.post(APIS.RESEND_OTP, payload);

        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : 'An unexpected error occurred';

          set({
            error: errorMessage,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },
      clearSuccess: () => {
        set({ success: false, });
      },
      cleanFlow: () => {
        set({
          success: false,
          error: null,
          isLoading: false,
          sessionKey: null,
          message: null,
          siteUrl: null,
          mfaMethod: null,
          url: null,
        });
      },

      fetchCurrentUserProfile: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(APIS.GET_CURRENT_USER, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const userData = response.data;

          // Update user with fresh data from backend
          const { user } = get();
          if (user) {
            const updatedUser = {
              ...user,
              first_name: userData.first_name || user.first_name,
              last_name: userData.last_name || user.last_name,
              email: userData.email || user.email,
              phone_number: userData.phone_number || user.phone_number,
              avatar_url: userData.avatar_url || user.avatar_url,
            };
            set({ user: updatedUser });
          }
        } catch (error) {
          // Silently fail - user data is already available from JWT
          console.debug('Failed to fetch current user profile:', error);
        }
      },


    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        workspace: state.workspace,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState>;
        return {
          ...currentState,
          user: persisted.user ?? currentState.user,
          workspace: persisted.workspace ?? currentState.workspace,
          isAuthenticated: persisted.isAuthenticated ?? currentState.isAuthenticated,
        };
      },
    }
  )
);
