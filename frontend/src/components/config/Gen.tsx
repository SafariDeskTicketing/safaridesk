import React, { useEffect, useMemo, useState } from "react";
import { Building, Upload, Camera, Loader2, Clipboard, ExternalLink, Play, AlertTriangle, Trash2, Shield, X } from "lucide-react";
import type { SessionUser } from "../../types";
import http from "../../services/http";
import { APIS } from "../../services/apis";
import { errorNotification, successNotification } from "../ui/Toast";
import { useAuthStore } from "../../stores/authStore";
import { DarkVariant, UIColorTheme, useUIStore } from "../../stores/uiStore";
import Select from "../ui/Select";
import { useBlocker, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { useValidateDomain } from "../../hooks/useValidateDomain";
import ConfirmDialog from "../ui/ConfirmDialog";

type Props = {
  user: SessionUser | null;
};

type ThemeModeOption = {
  id: "light" | "dark" | "system";
  label: string;
  description: string;
};

type AccentThemeOption = {
  id: UIColorTheme;
  label: string;
  description: string;
  swatch: string;
  color: string;
};

type DarkVariantOption = {
  id: DarkVariant;
  label: string;
  description: string;
};


const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  { id: "light", label: "Light", description: "Bright interface for daytime work." },
  { id: "dark", label: "Dark", description: "Charcoal UI with reduced glare." },
  { id: "system", label: "Auto", description: "Follows your device appearance." },
];

const ACCENT_THEME_OPTIONS: AccentThemeOption[] = [
  { id: "default",   label: "Cyan",        description: "Current SafariDesk cyan.",       swatch: "linear-gradient(90deg, #effcff 0%, #20b8cd 100%)", color: "#20b8cd" },
  { id: "indigo",    label: "Indigo",       description: "Professional indigo accent.",    swatch: "linear-gradient(90deg, #eef2ff 0%, #4f46e5 100%)", color: "#4f46e5" },
  { id: "microsoft", label: "Blue",         description: "Clean enterprise blue.",         swatch: "linear-gradient(90deg, #dcedfb 0%, #0078d4 100%)", color: "#0078d4" },
  { id: "forest",    label: "Forest",       description: "Balanced green for operations.", swatch: "linear-gradient(90deg, #d8f3e0 0%, #1f8f5a 100%)", color: "#1f8f5a" },
  { id: "red",       label: "Red",          description: "High-contrast executive red.",   swatch: "linear-gradient(90deg, #fee2e2 0%, #dc2626 100%)", color: "#dc2626" },
  { id: "gray",      label: "Gray",         description: "Gray, charcoal, smoke-white.",   swatch: "linear-gradient(90deg, #f3f4f6 0%, #6b7280 100%)", color: "#6b7280" },
];

const DARK_VARIANT_OPTIONS: DarkVariantOption[] = [
  {
    id: "current",
    label: "Dimmed Dark",
    description: "A brighter charcoal palette with high-contrast white text.",
  },
  {
    id: "github",
    label: "Pitch Dark",
    description: "A GitHub-inspired dark surface with crisp white typography.",
  },
];


const AUTH_BACKDROP_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const AUTH_BACKDROP_CROP_FRAME = {
  width: 640,
  height: 360,
};
const AUTH_BACKDROP_OUTPUT = {
  width: 1920,
  height: 1080,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatFileSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const configSectionClassName =
  "sd-config-card space-y-5";
const configSectionTitleClassName =
  "text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]";
const configSectionDescriptionClassName =
  "mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]";
const configSubsectionTitleClassName =
  "text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]";

const isValidColorTheme = (value: unknown): value is UIColorTheme =>
  value === "default" ||
  value === "indigo" ||
  value === "microsoft" ||
  value === "forest" ||
  value === "red" ||
  value === "gray";

const SettingsComponent: React.FC<Props> = ({ user }) => {
  const updateBusiness = useAuthStore((state) => state.updateBusiness);
  const { theme, setTheme, colorTheme, setColorTheme, darkVariant, setDarkVariant } = useUIStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
    colorTheme: state.colorTheme,
    setColorTheme: state.setColorTheme,
    darkVariant: state.darkVariant,
    setDarkVariant: state.setDarkVariant,
  }));
  const navigate = useNavigate();
  const { refetchDomainValidation, businessColorTheme } = useValidateDomain();
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [settings, setSettings] = useState({
    name: user?.business.name || "",
    email: user?.business.email || "",
    phone: user?.business.phone || "",
    timezone:
      user?.business.timezone ||
      detectedTimezone, // Auto-detect timezone
  });

  // Security settings state
  const [allowIdleLogout, setAllowIdleLogout] = useState<boolean>(
    user?.business.allow_idle_logout || false
  );
  const [idleSeconds, setIdleSeconds] = useState<number>(
    user?.business.idle_seconds || 900 // Default 15 minutes
  );

  // Check if onboarding is available to resume (reactive state)
  const [showResumeButton, setShowResumeButton] = useState(
    () => localStorage.getItem('onboardingCompleted') !== 'true'
  );

  const [timezones, setTimezones] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  const handleResumeSetup = () => {
    sessionStorage.removeItem('onboardingSkipped');
    navigate('/dashboard');
  };

  // Listen for changes in onboarding completion status
  useEffect(() => {
    const checkOnboardingStatus = () => {
      const isCompleted = localStorage.getItem('onboardingCompleted') === 'true';
      console.log('🔍 Checking onboarding status:', isCompleted);
      setShowResumeButton(!isCompleted);
    };

    // Check on mount and when window becomes visible
    checkOnboardingStatus();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkOnboardingStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for storage events (if changed from another tab)
    window.addEventListener('storage', checkOnboardingStatus);

    // Poll for changes every 2 seconds (fallback)
    const interval = setInterval(checkOnboardingStatus, 2000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', checkOnboardingStatus);
      clearInterval(interval);
    };
  }, []);

  const [logoPreview, setLogoPreview] = useState<string | null>(
    user?.business.logo_url || null,
  );
  const [faviconPreview, setFaviconPreview] = useState<string | null>(
    user?.business.favicon_url || null,
  );
  const [authBackdropPreview, setAuthBackdropPreview] = useState<string | null>(
    user?.business.auth_backdrop_url || null,
  );

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFileInfo, setLogoFileInfo] = useState<{ size: string; dimensions: string } | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconFileInfo, setFaviconFileInfo] = useState<{ size: string; dimensions: string } | null>(null);
  const [authBackdropFile, setAuthBackdropFile] = useState<File | null>(null);
  const [removeAuthBackdrop, setRemoveAuthBackdrop] = useState(false);
  const [showBackdropCropModal, setShowBackdropCropModal] = useState(false);
  const [backdropCropSource, setBackdropCropSource] = useState<string | null>(null);
  const [backdropNaturalSize, setBackdropNaturalSize] = useState({ width: 0, height: 0 });
  const [backdropZoom, setBackdropZoom] = useState(1);
  const [backdropOffsetX, setBackdropOffsetX] = useState(0);
  const [backdropOffsetY, setBackdropOffsetY] = useState(0);
  const [savedColorTheme, setSavedColorTheme] = useState<UIColorTheme>(() => colorTheme);
  const [savedTheme, setSavedTheme] = useState(theme);
  const [savedDarkVariant, setSavedDarkVariant] = useState(darkVariant);

  // Sync savedColorTheme from domain validation (the true server-side value)
  useEffect(() => {
    if (businessColorTheme && isValidColorTheme(businessColorTheme)) {
      setSavedColorTheme(businessColorTheme);
    }
  }, [businessColorTheme]);

  const handleInputChange = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
    // Populate timezones on component mount
    try {
      const allTimezones = (Intl as any).supportedValuesOf("timeZone"); // Cast to any to bypass TS error
      setTimezones(allTimezones);
    } catch (error) {
      console.error("Failed to get timezones:", error);
      // Fallback or error handling if Intl.supportedValuesOf is not supported
      setTimezones(["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const showDarkStyleOptions = theme === "dark" || (theme === "system" && systemPrefersDark);

  const backdropBaseScale =
    backdropNaturalSize.width > 0 && backdropNaturalSize.height > 0
      ? Math.max(
          AUTH_BACKDROP_CROP_FRAME.width / backdropNaturalSize.width,
          AUTH_BACKDROP_CROP_FRAME.height / backdropNaturalSize.height,
        )
      : 1;
  const backdropRenderedWidth = backdropNaturalSize.width * backdropBaseScale * backdropZoom;
  const backdropRenderedHeight = backdropNaturalSize.height * backdropBaseScale * backdropZoom;
  const backdropXRange = Math.max((backdropRenderedWidth - AUTH_BACKDROP_CROP_FRAME.width) / 2, 0);
  const backdropYRange = Math.max((backdropRenderedHeight - AUTH_BACKDROP_CROP_FRAME.height) / 2, 0);
  const backdropLeft = clamp(
    (AUTH_BACKDROP_CROP_FRAME.width - backdropRenderedWidth) / 2 + backdropOffsetX,
    AUTH_BACKDROP_CROP_FRAME.width - backdropRenderedWidth,
    0,
  );
  const backdropTop = clamp(
    (AUTH_BACKDROP_CROP_FRAME.height - backdropRenderedHeight) / 2 + backdropOffsetY,
    AUTH_BACKDROP_CROP_FRAME.height - backdropRenderedHeight,
    0,
  );

  useEffect(() => {
    setBackdropOffsetX((prev) => clamp(prev, -backdropXRange, backdropXRange));
    setBackdropOffsetY((prev) => clamp(prev, -backdropYRange, backdropYRange));
  }, [backdropXRange, backdropYRange]);

  useEffect(() => {
    if (isValidColorTheme(businessColorTheme)) {
      setSavedColorTheme(businessColorTheme);
    }
  }, [businessColorTheme]);

  const openBackdropCropper = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        errorNotification("Could not read the selected image. Please try again.");
        return;
      }

      const image = new Image();
      image.onload = () => {
        setBackdropNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
        setBackdropZoom(1);
        setBackdropOffsetX(0);
        setBackdropOffsetY(0);
        setBackdropCropSource(dataUrl);
        setShowBackdropCropModal(true);
      };
      image.onerror = () => {
        errorNotification("Unsupported image. Please choose a valid JPG, PNG, or WEBP file.");
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const closeBackdropCropper = () => {
    setShowBackdropCropModal(false);
    setBackdropCropSource(null);
    setBackdropZoom(1);
    setBackdropOffsetX(0);
    setBackdropOffsetY(0);
  };

  const applyBackdropCrop = async () => {
    if (!backdropCropSource || !backdropNaturalSize.width || !backdropNaturalSize.height) {
      errorNotification("Backdrop crop data is missing. Please select the image again.");
      return;
    }

    const image = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = backdropCropSource;
    });

    if (!loaded) {
      errorNotification("Failed to process the selected image. Please try another file.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = AUTH_BACKDROP_OUTPUT.width;
    canvas.height = AUTH_BACKDROP_OUTPUT.height;
    const ctx = canvas.getContext("2d");

    if (!ctx || backdropRenderedWidth <= 0 || backdropRenderedHeight <= 0) {
      errorNotification("Failed to crop backdrop image. Please try again.");
      return;
    }

    const sourceScaleX = backdropNaturalSize.width / backdropRenderedWidth;
    const sourceScaleY = backdropNaturalSize.height / backdropRenderedHeight;

    const sourceX = clamp(-backdropLeft * sourceScaleX, 0, backdropNaturalSize.width);
    const sourceY = clamp(-backdropTop * sourceScaleY, 0, backdropNaturalSize.height);
    const sourceWidth = Math.min(
      AUTH_BACKDROP_CROP_FRAME.width * sourceScaleX,
      backdropNaturalSize.width - sourceX,
    );
    const sourceHeight = Math.min(
      AUTH_BACKDROP_CROP_FRAME.height * sourceScaleY,
      backdropNaturalSize.height - sourceY,
    );

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      AUTH_BACKDROP_OUTPUT.width,
      AUTH_BACKDROP_OUTPUT.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
    });

    if (!blob) {
      errorNotification("Failed to crop backdrop image. Please try again.");
      return;
    }

    const croppedFile = new File([blob], `auth-backdrop-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    const previewReader = new FileReader();
    previewReader.onload = (e) => {
      setAuthBackdropPreview((e.target?.result as string) || null);
    };
    previewReader.readAsDataURL(croppedFile);

    setAuthBackdropFile(croppedFile);
    setRemoveAuthBackdrop(false);
    closeBackdropCropper();
  };

  const handleRemoveAuthBackdrop = () => {
    setAuthBackdropPreview(null);
    setAuthBackdropFile(null);
    setRemoveAuthBackdrop(true);
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "favicon" | "auth_backdrop",
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      if (type === "auth_backdrop") {
        if (!file.type.startsWith("image/")) {
          errorNotification("Please upload an image file for the auth backdrop.");
          return;
        }
        if (file.size > AUTH_BACKDROP_MAX_SIZE_BYTES) {
          errorNotification(
            `Auth backdrop must be 10 MB or less. Selected file is ${formatFileSize(file.size)}.`,
          );
          return;
        }

        openBackdropCropper(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const info = { size: formatFileSize(file.size), dimensions: `${img.naturalWidth}×${img.naturalHeight} px` };
          if (type === "logo") {
            setLogoPreview(dataUrl);
            setLogoFile(file);
            setLogoFileInfo(info);
          } else {
            setFaviconPreview(dataUrl);
            setFaviconFile(file);
            setFaviconFileInfo(info);
            const link = (document.querySelector("link[rel*='icon']") ||
              document.createElement("link")) as HTMLLinkElement;
            link.type = "image/x-icon";
            link.rel = "shortcut icon";
            link.href = dataUrl;
            document.getElementsByTagName("head")[0].appendChild(link);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true); // Show spinner
    try {
      const formData = new FormData();
      formData.append("name", settings.name);
      formData.append("email", settings.email);
      formData.append("phone", settings.phone);
      formData.append("timezone", settings.timezone); // Add timezone to form data
      if (logoFile) formData.append("logo", logoFile);
      if (faviconFile) formData.append("favicon", faviconFile);
      if (authBackdropFile) formData.append("auth_backdrop", authBackdropFile);
      if (removeAuthBackdrop && !authBackdropFile) formData.append("remove_auth_backdrop", "true");
      formData.append("allow_idle_logout", String(allowIdleLogout));
      formData.append("idle_seconds", String(idleSeconds));
      formData.append("color_theme", colorTheme);

      const response = await http.put(APIS.UPDATE_GENERAL_SETTINGS, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updatedBusiness = response.data?.business;

      if (updatedBusiness) {
        updateBusiness(updatedBusiness); // ⬅️ update zustand state
        setLogoPreview(updatedBusiness.logo_url || null);
        setFaviconPreview(updatedBusiness.favicon_url || null);
        setAuthBackdropPreview(updatedBusiness.auth_backdrop_url || null);
        setLogoFile(null);
        setLogoFileInfo(null);
        setFaviconFile(null);
        setFaviconFileInfo(null);
        setAuthBackdropFile(null);
        setRemoveAuthBackdrop(false);
        // Sync security settings from response
        if (updatedBusiness.allow_idle_logout !== undefined) {
          setAllowIdleLogout(updatedBusiness.allow_idle_logout);
        }
        if (updatedBusiness.idle_seconds !== undefined) {
          setIdleSeconds(updatedBusiness.idle_seconds);
        }
        if (isValidColorTheme(updatedBusiness.color_theme)) {
          setSavedColorTheme(updatedBusiness.color_theme);
        } else {
          setSavedColorTheme(colorTheme);
        }
        setSavedTheme(theme);
        setSavedDarkVariant(darkVariant);
        successNotification("Settings updated successfully!");
        refetchDomainValidation();
      }
    } catch (error: any) {
      console.error("Failed to update settings", error);
      errorNotification("Failed to update settings. Please try again.");
    } finally {
      setIsSaving(false); // Hide spinner
    }
  };

  const savedBusinessState = useMemo(
    () => ({
      name: user?.business.name || "",
      email: user?.business.email || "",
      phone: user?.business.phone || "",
      timezone: user?.business.timezone || detectedTimezone,
      allowIdleLogout: user?.business.allow_idle_logout || false,
      idleSeconds: user?.business.idle_seconds || 900,
    }),
    [
      detectedTimezone,
      user?.business.allow_idle_logout,
      user?.business.email,
      user?.business.idle_seconds,
      user?.business.name,
      user?.business.phone,
      user?.business.timezone,
    ]
  );

  const hasPendingBusinessChanges =
    settings.name !== savedBusinessState.name ||
    settings.email !== savedBusinessState.email ||
    settings.phone !== savedBusinessState.phone ||
    settings.timezone !== savedBusinessState.timezone ||
    allowIdleLogout !== savedBusinessState.allowIdleLogout ||
    idleSeconds !== savedBusinessState.idleSeconds;

  const hasPendingAssetChanges = Boolean(
    logoFile || faviconFile || authBackdropFile || removeAuthBackdrop
  );

  const hasPendingAppearanceChanges =
    colorTheme !== savedColorTheme ||
    theme !== savedTheme ||
    darkVariant !== savedDarkVariant;

  const hasPendingChanges =
    hasPendingBusinessChanges || hasPendingAssetChanges || hasPendingAppearanceChanges;
  const unsavedSettingsBlocker = useBlocker(hasPendingChanges);

  useEffect(() => {
    if (!hasPendingChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingChanges]);

  const isBusinessOwner = Number(user?.user_id) === user?.business?.owner_id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletionSubmitting, setIsDeletionSubmitting] = useState(false);

  const handleRequestBusinessDeletion = async () => {
    if (!user?.business?.id) return;
    setIsDeletionSubmitting(true);
    try {
      await http.post(`${APIS.BUSINESS_DELETION_REQUEST}${user.business.id}/request_deletion/`, {
        reason: deleteReason,
      });
      successNotification('Business deletion scheduled. It will be permanently deleted after 30 days.');
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setDeleteReason('');
    } catch (err: any) {
      errorNotification(err?.response?.data?.message || 'Failed to request deletion.');
    } finally {
      setIsDeletionSubmitting(false);
    }
  };

  return (
    <div className="sd-config-content">
        <ConfirmDialog
          show={unsavedSettingsBlocker.state === "blocked"}
          title="Leave page with unsaved changes?"
          message="You have unsaved general settings. Leaving now will discard those edits."
          confirmText="Leave"
          cancelText="Stay"
          variant="warning"
          cancel={() => unsavedSettingsBlocker.reset?.()}
          onConfirm={() => unsavedSettingsBlocker.proceed?.()}
        />
        {/* Page Header */}
        <div>
          <h1 className="text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)]">General</h1>
          <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Manage general settings of your app.
          </p>
        </div>

        <div className="sticky top-4 z-20 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[rgba(255,255,255,0.94)] px-3 py-2.5 shadow-[var(--shell-shadow-sm)] backdrop-blur dark:bg-[rgba(32,39,35,0.94)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                {hasPendingChanges ? "Unsaved changes" : "All saved"}
              </p>
              <p className="mt-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                {hasPendingChanges
                  ? "Business, branding, or color-theme edits are ready to save."
                  : "Mode and dark style apply instantly. Business, branding, and color theme require Save Changes."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[var(--font-meta)] font-medium ${
                  hasPendingChanges
                    ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                    : "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                }`}
              >
                {hasPendingChanges ? "Unsaved changes" : "Everything saved"}
              </span>
              <Button onClick={handleSave} loading={isSaving} disabled={!hasPendingChanges}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Resume Setup Wizard Card */}
        {showResumeButton && (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 shadow-[var(--shell-shadow-sm)] dark:bg-[rgba(49,94,251,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--status-info-text)]">
                  Complete Your Setup
                </h3>
                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--status-info-text)]">
                  Haven't finished setting up SafariDesk? Resume the onboarding wizard to complete your configuration and get the most out of the platform.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleResumeSetup}
                  size="sm"
                  icon={Play}
                >
                  Resume Setup
                </Button>
                <button
                  onClick={() => {
                    localStorage.setItem('onboardingCompleted', 'true');
                    setShowResumeButton(false);
                  }}
                  title="Dismiss"
                  className="p-1.5 rounded-[var(--shell-radius)] text-[var(--status-info-text)] hover:bg-[var(--status-info-border)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Organization + Branding */}
        <div className={configSectionClassName}>
          <h3 className={configSectionTitleClassName}>Organization & Branding</h3>
          <p className={configSectionDescriptionClassName}>
            Manage system URLs, business details, and brand assets in one place.
          </p>

          <div className="mt-6">
            <h4 className={configSubsectionTitleClassName}>System URLs</h4>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workspace URL
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] rounded-l-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    value={user?.business.domain_url || ""}
                  />
                  <button
                    onClick={() => {
                        if (user?.business.domain_url) {
                        navigator.clipboard.writeText(user.business.domain_url);
                        successNotification("Workspace URL copied to clipboard!");
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] border-l-0 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Copy URL"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (user?.business.domain_url) {
                        window.open(user.business.domain_url, "_blank");
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] border-l-0 rounded-r-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Navigate to URL"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer portal URL
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] rounded-l-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    value={user?.business.support_url || ""}
                  />
                  <button
                    onClick={() => {
                      if (user?.business.support_url) {
                        navigator.clipboard.writeText(user.business.support_url);
                        successNotification("Customer portal URL copied to clipboard!");
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] border-l-0 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Copy URL"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (user?.business.support_url) {
                        window.open(user?.business.support_url, "_blank");
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] border-l-0 rounded-r-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Navigate to URL"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[var(--border-color)]">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Business Information</h4>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] rounded-lg bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-[var(--text-primary)]"
                  value={settings.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Support Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-[var(--border-color)] rounded bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-[var(--text-primary)] placeholder:text-xs"
                  value={settings.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Support Phone
                </label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-[var(--border-color)] rounded bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-[var(--text-primary)] placeholder:text-xs"
                  value={settings.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <Select
                  options={timezones.map((tz) => ({ value: tz, label: tz }))}
                  value={settings.timezone}
                  onChange={(value) => handleInputChange("timezone", value)}
                  placeholder="Select a timezone"
                  allowSearch={true}
                  size="sm"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[var(--border-color)]">
            <h4 className="text-[length:var(--font-body)] font-semibold text-[var(--text-primary)]">Branding</h4>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-4 rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4 bg-[var(--surface-subtle)]">
                <div className="w-16 h-16 border border-[var(--border-color)] rounded-[var(--shell-radius)] flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--surface-muted)]">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <Building className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Logo</label>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mt-1">
                    Appears in the sidebar. PNG or SVG, min 32×32 px.
                  </p>
                  {logoFileInfo && (
                    <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)] mt-1">
                      {logoFileInfo.dimensions} · {logoFileInfo.size}
                    </p>
                  )}
                  <label className="mt-3 inline-flex bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-[var(--shell-radius)] cursor-pointer items-center gap-1.5 text-[length:var(--font-label)] font-medium transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "logo")} />
                  </label>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4 bg-[var(--surface-subtle)]">
                <div className="w-16 h-16 border border-[var(--border-color)] rounded-[var(--shell-radius)] flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--surface-muted)]">
                  {faviconPreview ? (
                    <img src={faviconPreview} alt="Favicon preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Favicon</label>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mt-1">
                    Browser tab icon. PNG or ICO, min 32×32 px.
                  </p>
                  {faviconFileInfo && (
                    <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)] mt-1">
                      {faviconFileInfo.dimensions} · {faviconFileInfo.size}
                    </p>
                  )}
                  <label className="mt-3 inline-flex bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-[var(--shell-radius)] cursor-pointer items-center gap-1.5 text-[length:var(--font-label)] font-medium transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "favicon")} />
                  </label>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4 bg-[var(--surface-subtle)] md:col-span-2">
                <div className="w-24 h-16 border border-[var(--border-color)] rounded-[var(--shell-radius)] flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--surface-muted)]">
                  {authBackdropPreview ? (
                    <img src={authBackdropPreview} alt="Auth backdrop preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Auth Backdrop</label>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mt-1">
                    Shown on login/signup pages. Best fit: 1920×1080 (16:9), JPG or PNG, max 10 MB.
                  </p>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mt-0.5">
                    Upload opens a crop step — you can reposition before saving.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-[var(--shell-radius)] cursor-pointer items-center gap-1.5 text-[length:var(--font-label)] font-medium transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Crop</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "auth_backdrop")} />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveAuthBackdrop}
                      className="inline-flex border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] px-3 py-1.5 rounded-[var(--shell-radius)] items-center gap-1.5 text-[length:var(--font-label)] font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Use Default</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className={configSectionClassName}>
          <h3 className={configSectionTitleClassName}>Appearance</h3>
          <p className={configSectionDescriptionClassName}>
            Interface mode and accent color for your workspace.
          </p>

          {/* Mode + Dark variant row */}
          <div className="flex flex-wrap gap-5 items-start">
            <div>
              <p className="mb-2 text-[length:var(--font-label)] font-medium text-[var(--text-muted)]">Mode</p>
              <div className="inline-flex rounded-[var(--shell-radius)] border border-[var(--border-color)] overflow-hidden">
                {THEME_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    title={option.description}
                    className={`px-3 py-1.5 text-[length:var(--font-label)] border-l first:border-l-0 border-[var(--border-color)] transition-colors ${
                      theme === option.id
                        ? 'bg-[var(--primary-600,#2563eb)] text-white'
                        : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {showDarkStyleOptions && (
              <div>
                <p className="mb-2 text-[length:var(--font-label)] font-medium text-[var(--text-muted)]">Dark Style</p>
                <div className="inline-flex rounded-[var(--shell-radius)] border border-[var(--border-color)] overflow-hidden">
                  {DARK_VARIANT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDarkVariant(option.id)}
                      title={option.description}
                      className={`px-3 py-1.5 text-[length:var(--font-label)] border-l first:border-l-0 border-[var(--border-color)] transition-colors ${
                        darkVariant === option.id
                          ? 'bg-[var(--primary-600,#2563eb)] text-white'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Accent Color */}
          <div>
            <p className="mb-3 text-[length:var(--font-label)] font-medium text-[var(--text-muted)]">
              Accent Color
              <span className="ml-2 text-[length:var(--font-meta)] font-normal text-[var(--text-muted)]">applies to all users on this workspace</span>
            </p>
            <div className="flex flex-wrap gap-4">
              {ACCENT_THEME_OPTIONS.map((option) => {
                const selected = colorTheme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setColorTheme(option.id)}
                    title={option.description}
                    className="flex flex-col items-center gap-1.5 focus:outline-none"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${selected ? 'scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                      style={{
                        backgroundColor: option.color,
                        boxShadow: selected ? `0 0 0 2px var(--card-bg), 0 0 0 4px ${option.color}` : undefined,
                      }}
                    >
                      {selected && (
                        <svg className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[length:var(--font-meta)] ${selected ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className={configSectionClassName}>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className={configSectionTitleClassName}>Security</h3>
          </div>
          <p className={configSectionDescriptionClassName}>
            Configure security settings for your workspace.
          </p>

          <div className="mt-6">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="allowIdleLogout"
                checked={allowIdleLogout}
                onChange={(e) => setAllowIdleLogout(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div className="flex-1">
                <label htmlFor="allowIdleLogout" className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] cursor-pointer">
                  Enable idle logout
                </label>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)] mt-1">
                  Automatically log out users after a period of inactivity to enhance security.
                </p>
              </div>
            </div>

            {allowIdleLogout && (
              <div className="mt-4 ml-7">
                <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-secondary)] mb-2">
                  Idle timeout (seconds)
                </label>
                <input
                  type="number"
                  min={60}
                  max={86400}
                  value={idleSeconds}
                  onChange={(e) => setIdleSeconds(Math.max(60, parseInt(e.target.value) || 60))}
                  className="w-48 px-3 py-2 text-[length:var(--font-body)] border border-[var(--border-color)] rounded-[var(--shell-radius)] bg-[var(--card-bg)] text-[var(--text-primary)]"
                  placeholder="900"
                />
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)] mt-1">
                  Users will be logged out after {Math.floor(idleSeconds / 60)} minute{Math.floor(idleSeconds / 60) !== 1 ? 's' : ''} of inactivity. Minimum: 60 seconds.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone — business owner only */}
        {isBusinessOwner && (
          <div
            className="sd-config-card"
            style={{ borderColor: 'var(--status-danger-border)' }}
          >
            <h3 className="text-[length:var(--font-section-title)] font-semibold" style={{ color: 'var(--status-danger-text)' }}>Danger Zone</h3>
            <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mt-1">
              Irreversible actions that affect the entire business workspace.
            </p>
            <div
              className="mt-6 flex items-start justify-between gap-4 border rounded-[var(--shell-radius)] p-4"
              style={{ borderColor: 'var(--status-danger-border)', backgroundColor: 'var(--status-danger-bg)' }}
            >
              <div>
                <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Delete this business</p>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)] mt-1">
                  Schedules a permanent deletion of this workspace and all its data after a 30-day grace period.
                  The business will be deactivated immediately.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-[length:var(--font-button)] font-medium rounded-[var(--shell-radius)] border transition-colors"
                style={{ color: 'var(--status-danger-text)', borderColor: 'var(--status-danger-border)' }}
              >
                <Trash2 className="w-4 h-4" />
                Delete Business
              </button>
            </div>
          </div>
        )}

      {/* Business Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-4 rounded-t-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-300">Delete Business</h3>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">This action cannot be undone after 30 days.</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p className="font-medium">This will permanently delete:</p>
                <ul className="list-disc list-inside text-gray-500 dark:text-gray-400 text-xs space-y-1 ml-1">
                  <li>All tickets, comments, and attachments</li>
                  <li>All agents, departments, and settings</li>
                  <li>All tasks, knowledge base articles, and assets</li>
                  <li>All email templates, SLA policies, and integrations</li>
                </ul>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  placeholder="Why is this business being deleted?"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{user?.business?.name}</span> to confirm
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder={user?.business?.name}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeleteReason(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestBusinessDeletion}
                disabled={deleteConfirmText !== user?.business?.name || isDeletionSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeletionSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Schedule Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackdropCropModal && backdropCropSource && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Crop Auth Backdrop</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Adjust zoom and position. We save this as a 16:9 backdrop for login and signup pages.</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="mx-auto rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800"
                style={{
                  width: AUTH_BACKDROP_CROP_FRAME.width,
                  maxWidth: "100%",
                  aspectRatio: "16 / 9",
                  position: "relative",
                }}
              >
                <img
                  src={backdropCropSource}
                  alt="Backdrop crop preview"
                  style={{
                    position: "absolute",
                    left: `${backdropLeft}px`,
                    top: `${backdropTop}px`,
                    width: `${backdropRenderedWidth}px`,
                    height: `${backdropRenderedHeight}px`,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-xs text-gray-600 dark:text-gray-300">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={backdropZoom}
                    onChange={(e) => setBackdropZoom(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </label>
                <label className="text-xs text-gray-600 dark:text-gray-300">
                  Horizontal
                  <input
                    type="range"
                    min={-backdropXRange}
                    max={backdropXRange}
                    step={1}
                    value={backdropOffsetX}
                    onChange={(e) => setBackdropOffsetX(Number(e.target.value))}
                    className="w-full mt-2"
                    disabled={backdropXRange === 0}
                  />
                </label>
                <label className="text-xs text-gray-600 dark:text-gray-300">
                  Vertical
                  <input
                    type="range"
                    min={-backdropYRange}
                    max={backdropYRange}
                    step={1}
                    value={backdropOffsetY}
                    onChange={(e) => setBackdropOffsetY(Number(e.target.value))}
                    className="w-full mt-2"
                    disabled={backdropYRange === 0}
                  />
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button
                type="button"
                onClick={closeBackdropCropper}
                className="px-4 py-2 text-[length:var(--font-button)] font-medium text-[var(--text-primary)] border border-[var(--border-color)] rounded-[var(--shell-radius)] hover:bg-[var(--surface-subtle)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyBackdropCrop}
                className="px-4 py-2 text-[length:var(--font-button)] font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-[var(--shell-radius)]"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsComponent;
