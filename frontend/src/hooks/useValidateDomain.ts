import { APIS } from '../services/apis';
import { DOMAIN_VALIDATION_EXEMPTED_PATHS, SESSION_PUBLIC_EXEMPTED_PATHS } from '../routes/config';
import { useAuthStore } from '../stores/authStore'; // Import useAuthStore
import { useEffect } from 'react'; // Import useEffect
import { useQuery } from '@tanstack/react-query';
import { errorNotification } from '../components/ui/Toast';
import http from '../services/http';
import { SITE_URL } from '../utils/base';
import { useUIStore } from '../stores/uiStore';

interface Department {
  id: number;
  name: string;
  slag: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface DomainValidationResponse {
  business_id: number;
  business_name: string;
  logo_url?: string;
  favicon_url?: string;
  auth_backdrop_url?: string;
  color_theme?: string;
  departments: Department[];
  ticket_categories: Category[];
}

interface UseValidateDomainResult {
  isLoadingDomain: boolean;
  domainError: boolean;
  categories: Category[];
  departments: Department[];
  refetchDomainValidation: () => void;
  businessId?: number;
  businessName?: string;
  businessLogoUrl?: string;
  businessFaviconUrl?: string;
  businessAuthBackdropUrl?: string;
  businessColorTheme?: string;
}

const fetchDomainValidation = async (): Promise<DomainValidationResponse> => {
  const response = await http.post<DomainValidationResponse>(APIS.VALIDATE_DOMAIN, {
    url: window.location.href,
  });
  return response.data;
};


export const useValidateDomain = (): UseValidateDomainResult => {
  const currentPathname = window.location.pathname;
  const isExemptedPath = DOMAIN_VALIDATION_EXEMPTED_PATHS.some(path => currentPathname.startsWith(path));
  const { user, logout, isAuthenticated } = useAuthStore();
  const { applyBusinessColorTheme } = useUIStore();

  const {
    data,
    isLoading: isLoadingDomain,
    isError: domainError,
    refetch: refetchDomainValidation,
  } = useQuery<DomainValidationResponse, Error>({
    queryKey: ['domainValidation', window.location.origin],
    queryFn: fetchDomainValidation,
    enabled: !isExemptedPath,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });


  useEffect(() => {
    if (isAuthenticated && data && user?.business?.id && data.business_id !== user.business.id) {
      errorNotification('Logged-in user business ID does not match validated domain business ID. Logging out.');
      logout();
    }
  }, [isAuthenticated, data, user, logout]);

  useEffect(() => {
    if (domainError && !isExemptedPath) {
      const currentPath = window.location.pathname;
      const siteUrlPath = new URL(SITE_URL, window.location.origin).pathname;
      const isPublicPath = SESSION_PUBLIC_EXEMPTED_PATHS.some(p => currentPath.startsWith(p));
      if (!currentPath.startsWith(siteUrlPath) && !isPublicPath) {
        console.warn('Domain validation failed, redirecting to:', SITE_URL);
        window.location.href = SITE_URL;
      }
    }
  }, [domainError, isExemptedPath]);

  // Update favicon and title when data is loaded
  useEffect(() => {
    if (data) {
      // Update document title
      if (data.business_name) {
        document.title = data.business_name;
      }

      // Update favicon
      const faviconUrl = data.favicon_url || '/src/assets/safaridesk-logo.svg';
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        link.type = 'image/png';
        link.sizes = '32x32';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [data]);

  // Apply business-level color theme for all users on this subdomain (no user-prefs sync)
  useEffect(() => {
    if (data?.color_theme) {
      applyBusinessColorTheme(data.color_theme as Parameters<typeof applyBusinessColorTheme>[0]);
    }
  }, [data?.color_theme, applyBusinessColorTheme]);

  if (isExemptedPath) {
    return {
      isLoadingDomain: false,
      domainError: false,
      categories: [],
      departments: [],
      refetchDomainValidation: () => {},
    };
  }

  return {
    isLoadingDomain,
    domainError,
    categories: data?.ticket_categories || [],
    departments: data?.departments || [],
    businessId: data?.business_id,
    businessName: data?.business_name,
    businessLogoUrl: data?.logo_url,
    businessFaviconUrl: data?.favicon_url,
    businessAuthBackdropUrl: data?.auth_backdrop_url,
    businessColorTheme: data?.color_theme,
    refetchDomainValidation: () => { refetchDomainValidation(); },
  };
};
