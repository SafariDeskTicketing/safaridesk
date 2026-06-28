import React, { useState, useEffect } from "react";
import Button from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { APIS } from "../../services/apis";
import http from "../../services/http";
import { errorNotification, successNotification } from "../ui/Toast";
import { Loader } from "../loader/loader";

interface SMTPFormData {
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
  use_ssl: boolean;
  default_from_email: string;
  sender_name: string;
  reply_to_email: string;
}

export const SmtpSettings: React.FC = () => {
  const [formData, setFormData] = useState<SMTPFormData>({
    host: "",
    port: 587,
    username: "",
    password: "",
    use_tls: true,
    use_ssl: false,
    default_from_email: "",
    sender_name: "",
    reply_to_email: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load SMTP configuration on component mount
  useEffect(() => {
    const loadSMTPConfig = async () => {
      setIsLoading(true);
      try {
        const response = await http.get(APIS.SETTING_LOAD_SMTP);

        // If config exists, populate form
        if (response.data && !response.data.message) {
          setFormData({
            host: response.data.host || "",
            port: response.data.port || 587,
            username: response.data.username || "",
            password: response.data.password || "",
            use_tls: response.data.use_tls || false,
            use_ssl: response.data.use_ssl || false,
            default_from_email: response.data.default_from_email || "",
            sender_name: response.data.sender_name || "",
            reply_to_email: response.data.reply_to_email || "",
          });
        }
        // If no config found, keep default values
      } catch (error) {
        console.error("Error loading SMTP settings:", error);
        setMessage({ type: "error", text: "Failed to load SMTP settings." });
      } finally {
        setIsLoading(false);
      }
    };

    loadSMTPConfig();
  }, []);

  const handleInputChange = (
    field: keyof SMTPFormData,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await http.post(APIS.SETTING_SET_SMTP, formData);
      successNotification(response.data.message);
      setMessage({
        type: "success",
        text: response.data.message || "SMTP settings saved successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to save SMTP settings. Please try again.",
      });
      errorNotification("Error saving SMTP settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: "error", text: "Please enter a test email address." });
      return;
    }

    setIsTesting(true);
    setMessage(null);

    try {
      const response = await http.post(APIS.SETTING_TEST_SMTP, {
        email: testEmail,
      });
      successNotification(response.data.message);
      setMessage({
        type: "success",
        text: response.data.message || "Test email sent successfully.",
      });
      setShowTestModal(false);
      setTestEmail("");
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to send test email. Please check your SMTP settings.",
      });
      errorNotification("Error sending test email");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="surface-card p-6">
      {isLoading && <Loader />}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
          SMTP Email Settings
        </h2>
        <div className="flex items-center space-x-2">
          <div
            className={`h-2 w-2 rounded-full ${formData.host ? "bg-primary-700" : "bg-gray-600"}`}
          ></div>
          <span className="text-sm text-[var(--text-secondary)]">
            {formData.host ? "Configured" : "Not configured"}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-[var(--shell-radius)] border ${
            message.type === "success"
              ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]"
              : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]"
          }`}
        >
          <div className="flex items-center">
            <div className="mr-3 h-4 w-4 flex-shrink-0">
              {message.type === "success" ? (
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Server Configuration */}
        <div className="bg-gray-50 dark:bg-surface-50 rounded-[var(--shell-radius)] p-6 border border-[var(--border-color)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
              />
            </svg>
            Server Configuration
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Input
                label="SMTP Host"
                value={formData.host}
                onChange={(e) => handleInputChange("host", e.target.value)}
                placeholder="e.g., smtp.gmail.com"
                required
                fullWidth
              />
            </div>
            <div className="space-y-1">
              <Input
                label="SMTP Port"
                type="number"
                value={formData.port.toString()}
                onChange={(e) =>
                  handleInputChange("port", parseInt(e.target.value) || 587)
                }
                placeholder="587, 465, or 25"
                required
                fullWidth
              />
            </div>
            <div className="space-y-1">
              <Input
                label="Username"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                placeholder="Your SMTP username"
                required
                fullWidth
              />
            </div>
            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                placeholder="Your SMTP password"
                required
                fullWidth
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-gray-50 dark:bg-surface-50 rounded-[var(--shell-radius)] p-6 border border-[var(--border-color)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Security Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <label className="flex cursor-pointer items-center rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-4 transition-colors hover:bg-[var(--surface-subtle)]">
              <input
                type="checkbox"
                checked={formData.use_tls}
                onChange={(e) => handleInputChange("use_tls", e.target.checked)}
                className="rounded border-gray-300 dark:border-subtle text-primary-600 focus:ring-primary-500 dark:bg-surface-hover"
              />
              <div className="ml-3">
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                  Use TLS encryption
                </span>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  Recommended for port 587
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-4 transition-colors hover:bg-[var(--surface-subtle)]">
              <input
                type="checkbox"
                checked={formData.use_ssl}
                onChange={(e) => handleInputChange("use_ssl", e.target.checked)}
                className="rounded border-gray-300 dark:border-subtle text-primary-600 focus:ring-primary-500 dark:bg-surface-hover"
              />
              <div className="ml-3">
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                  Use SSL encryption
                </span>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  Recommended for port 465
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Email Configuration */}
        <div className="bg-gray-50 dark:bg-surface-50 rounded-[var(--shell-radius)] p-6 border border-[var(--border-color)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email Configuration
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Input
                label="Default From Email"
                type="email"
                value={formData.default_from_email}
                onChange={(e) =>
                  handleInputChange("default_from_email", e.target.value)
                }
                placeholder="noreply@yourcompany.com"
                required
                fullWidth
              />
            </div>
            <div className="space-y-1">
              <Input
                label="Sender Name"
                value={formData.sender_name}
                onChange={(e) =>
                  handleInputChange("sender_name", e.target.value)
                }
                placeholder="Your Company Name"
                required
                fullWidth
              />
            </div>
            <div className="lg:col-span-2 space-y-1">
              <Input
                label="Reply To Email"
                type="email"
                value={formData.reply_to_email}
                onChange={(e) =>
                  handleInputChange("reply_to_email", e.target.value)
                }
                placeholder="support@yourcompany.com"
                fullWidth
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-[var(--border-color)]">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowTestModal(true)}
            disabled={isSubmitting || !formData.host}
            className="w-full sm:w-auto"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Test Email
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Test Email Modal */}
      <Modal
        isOpen={showTestModal}
        onClose={() => {
          setShowTestModal(false);
          setTestEmail("");
        }}
        title="Send Test Email"
      >
        <div className="space-y-6">
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-[var(--shell-radius)] p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-primary-500 mr-3 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-[length:var(--font-label)] font-medium text-primary-800 dark:text-primary-200">
                  Test Email
                </h4>
                <p className="text-[length:var(--font-body)] text-primary-700 dark:text-primary-300 mt-1">
                  This will send a test email using your current SMTP
                  configuration to verify it's working correctly.
                </p>
              </div>
            </div>
          </div>

          <Input
            label="Test Email Address"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email address to test"
            fullWidth
            required
          />

          <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              onClick={handleTestEmail}
              disabled={isTesting || !testEmail}
            >
              {isTesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  Send Test
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
