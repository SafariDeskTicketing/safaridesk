import React, { useState, useEffect } from "react";
import { 
  CreditCard, Calendar, CheckCircle2, DollarSign, X, Check, 
  Loader2, AlertCircle, XCircle, ChevronRight, Download 
} from "lucide-react";
import http from "../../services/http";
import { APIS } from "../../services/apis";
import { errorNotification, successNotification } from "../ui/Toast";

// Dummy packages
const PACKAGES = [
  {
    id: "basic",
    name: "Basic Plan",
    price: 100, // in cents
    currency: "usd",
    description: "Perfect for small teams",
    features: [
      "Up to 5 users",
      "50 tickets per month",
      "Email support",
      "Basic reporting",
    ],
  },
  {
    id: "pro",
    name: "Pro Plan",
    price: 150,
    currency: "usd",
    description: "For growing businesses",
    features: [
      "Up to 25 users",
      "Unlimited tickets",
      "Priority support",
      "Advanced reporting",
      "API access",
      "Custom branding",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    price: 200,
    currency: "usd",
    description: "For large organizations",
    features: [
      "Unlimited users",
      "Unlimited tickets",
      "24/7 dedicated support",
      "Advanced analytics",
      "Full API access",
      "Custom integrations",
      "SLA guarantees",
    ],
  },
];

interface Payment {
  id: string;
  session_id: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  customer_email: string;
  metadata: any;
  created_at: string;
  stripe_response: any;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Payment[];
}

export const Billing: React.FC = () => {
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showPollingDialog, setShowPollingDialog] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<typeof PACKAGES[0] | null>(null);
  const [pollingMessage, setPollingMessage] = useState("Processing your payment...");
  const [errorMessage, setErrorMessage] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [pollingTimeoutId, setPollingTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [creatingIntent, setCreatingIntent] = useState<string | null>(null);

  // Load payments on mount
  useEffect(() => {
    loadPayments();
  }, [currentPage]);

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const response = await http.get<PaginatedResponse>(
        `${APIS.PAYMENT_LIST}?page=${currentPage}`
      );
      setPayments(response.data.results);
      setTotalCount(response.data.count);
      setTotalPages(Math.ceil(response.data.count / 10)); // Assuming 10 per page
    } catch (error: any) {
      console.error("Error loading payments:", error);
      errorNotification(error?.response?.data?.error || "Failed to load payments");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleUpgradeClick = () => {
    setShowPackageModal(true);
  };

  const handlePackageSelect = async (pkg: typeof PACKAGES[0]) => {
    // Prevent double-clicking if already creating intent
    if (creatingIntent) return;
    
    setSelectedPackage(pkg);
    setCreatingIntent(pkg.id);
    
    try {
      // Create payment intent
      const intentResponse = await http.post(APIS.PAYMENT_CREATE_INTENT, {
        amount: pkg.price,
        currency: pkg.currency,
        description: `${pkg.name} Subscription`,
        metadata: {
          plan: pkg.id,
          order_id: `ORD-${Date.now()}`,
          subscription_type: "monthly",
        },
      });

      const { session_id, checkout_url } = intentResponse.data;

      // Close modal only after successful intent creation
      setShowPackageModal(false);
      setCreatingIntent(null);

      // Open checkout in new window
      window.open(checkout_url, "_blank");

      // Start polling
      setShowPollingDialog(true);
      setPollingMessage("Processing your payment...");
      await startPolling(session_id);
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      setCreatingIntent(null);
      errorNotification(
        error?.response?.data?.error || "Failed to create payment intent"
      );
    }
  };

  const stopPolling = () => {
    if (pollingTimeoutId) {
      clearTimeout(pollingTimeoutId);
      setPollingTimeoutId(null);
    }
  };

  const handleCancelPolling = () => {
    stopPolling();
    setShowPollingDialog(false);
    setPollingMessage("Processing your payment...");
  };

  const startPolling = async (sessionId: string) => {
    const pollInterval = 2000; // 2 seconds
    const maxDuration = 60000; // 60 seconds (1 minute)
    const startTime = Date.now();
    let attempts = 0;

    const poll = async (): Promise<void> => {
      attempts++;
      const elapsed = Date.now() - startTime;

      if (elapsed >= maxDuration) {
        // Timeout
        stopPolling();
        setShowPollingDialog(false);
        setErrorMessage(
          "Payment verification timed out. Please check your payment history or try again."
        );
        setShowErrorModal(true);
        return;
      }

      try {
        const response = await http.get(
          `${APIS.PAYMENT_STATUS}?session_id=${sessionId}`
        );
        const paymentData = response.data;
        const { payment_status } = paymentData;

        if (payment_status === "paid") {
          // Success!
          stopPolling();
          setShowPollingDialog(false);
          setPaymentDetails(paymentData);
          setShowSuccessModal(true);
          return;
        } else if (
          payment_status === "failed" ||
          payment_status === "cancelled"
        ) {
          // Failed
          stopPolling();
          setShowPollingDialog(false);
          setErrorMessage(
            `Payment ${payment_status}. Please try again or contact support.`
          );
          setShowErrorModal(true);
          return;
        }

        // Continue polling
        const timeoutId = setTimeout(poll, pollInterval);
        setPollingTimeoutId(timeoutId);
      } catch (error: any) {
        console.error("Polling error:", error);
        // Continue polling on error (might be temporary network issue)
        if (elapsed < maxDuration) {
          const timeoutId = setTimeout(poll, pollInterval);
          setPollingTimeoutId(timeoutId);
        } else {
          stopPolling();
          setShowPollingDialog(false);
          setErrorMessage("Error verifying payment. Please check your payment history.");
          setShowErrorModal(true);
        }
      }
    };

    // Start the first poll
    const timeoutId = setTimeout(poll, pollInterval);
    setPollingTimeoutId(timeoutId);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      paid: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-400", label: "Paid" },
      pending: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-400", label: "Pending" },
      failed: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-400", label: "Failed" },
      cancelled: { bg: "bg-gray-100 dark:bg-gray-900/30", text: "text-gray-800 dark:text-gray-400", label: "Cancelled" },
      unpaid: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-400", label: "Unpaid" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-full sd-config-content">
        <div className="mb-4">
          <h2 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Billing & Subscription
          </h2>
          <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)] mt-1">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Current Plan */}
        <div className="surface-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-[length:var(--font-section-title)] font-medium text-[var(--text-primary)]">
                  Current Plan
                </h3>
                <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mt-1">
                  Upgrade to access more features
                </p>
              </div>
            </div>
            <button
              onClick={handleUpgradeClick}
              className="px-4 py-2 text-[length:var(--font-button)] font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 rounded-[var(--shell-radius)] transition-colors"
            >
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* Payment History */}
        <div className="surface-card">
          <div className="px-6 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-[length:var(--font-section-title)] font-medium text-[var(--text-primary)]">
              Payment History
            </h3>
          </div>
          
          {loadingPayments ? (
            <div className="px-6 py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : payments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No payment history yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[length:var(--font-meta)] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-[length:var(--font-meta)] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-[length:var(--font-meta)] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-[length:var(--font-meta)] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[var(--border-color)]">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-6 py-4 whitespace-nowrap text-[length:var(--font-body)] text-[var(--text-primary)]">
                          {formatDate(payment.created_at)}
                        </td>
                        <td className="px-6 py-4 text-[length:var(--font-body)] text-[var(--text-primary)]">
                          {payment.metadata?.plan ? `${payment.metadata.plan} Plan` : "Subscription Payment"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(payment.amount_total, payment.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(payment.payment_status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-[var(--border-color)] flex items-center justify-between">
                  <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
                    Showing page {currentPage} of {totalPages} ({totalCount} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-[length:var(--font-body)] border border-[var(--border-color)] rounded-[var(--shell-radius)] disabled:opacity-50 hover:bg-[var(--surface-subtle)]"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-[length:var(--font-body)] border border-[var(--border-color)] rounded-[var(--shell-radius)] disabled:opacity-50 hover:bg-[var(--surface-subtle)]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Package Selection Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setShowPackageModal(false)} />
            
            <div className="inline-block w-full max-w-5xl px-6 py-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Choose Your Plan
                </h3>
                <button
                  onClick={() => setShowPackageModal(false)}
                  disabled={creatingIntent !== null}
                  className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PACKAGES.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative border-2 rounded-xl p-6 transition-all ${
                      creatingIntent === null ? 'cursor-pointer hover:shadow-lg' : 'cursor-not-allowed opacity-75'
                    } ${
                      pkg.popular
                        ? "border-primary-600 dark:border-primary-500 shadow-md"
                        : "border-gray-200 dark:border-[var(--border-color)]"
                    } ${
                      creatingIntent === pkg.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                    onClick={() => creatingIntent === null && handlePackageSelect(pkg)}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          POPULAR
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h4 className="text-[length:var(--font-section-title)] font-bold text-gray-900 dark:text-white mb-2">
                        {pkg.name}
                      </h4>
                      <p className="text-[length:var(--font-body)] text-gray-500 dark:text-gray-400 mb-4">
                        {pkg.description}
                      </p>
                      <div className="mb-6">
                        <span className="text-[length:var(--font-display-xl)] font-bold text-gray-900 dark:text-white">
                          {formatCurrency(pkg.price, pkg.currency)}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">/month</span>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {pkg.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-[length:var(--font-body)] text-gray-600 dark:text-gray-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <button
                      disabled={creatingIntent !== null}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        pkg.popular
                          ? "bg-primary-600 text-white hover:bg-primary-700"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {creatingIntent === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Select Plan'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Polling Dialog */}
      {showPollingDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={handleCancelPolling} />
            
            <div className="inline-block w-full max-w-md px-6 py-8 my-8 overflow-hidden text-center align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl relative">
              <button
                onClick={handleCancelPolling}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex flex-col items-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary-600 mb-4" />
                <h3 className="text-[length:var(--font-section-title)] font-bold text-gray-900 dark:text-white mb-2">
                  {pollingMessage}
                </h3>
                <p className="text-[length:var(--font-body)] text-gray-500 dark:text-gray-400">
                  Please wait while we verify your payment...
                </p>
                <p className="text-[length:var(--font-meta)] text-gray-400 dark:text-gray-500 mt-4">
                  This may take up to 60 seconds
                </p>
                <button
                  onClick={handleCancelPolling}
                  className="mt-6 px-4 py-2 text-[length:var(--font-label)] text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => {
              setShowSuccessModal(false);
              loadPayments();
            }} />
            
            <div className="inline-block w-full max-w-lg px-6 py-8 my-8 overflow-hidden align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-[length:var(--font-stat-value)] font-bold text-gray-900 dark:text-white mb-2">
                  Payment Successful!
                </h3>
                <p className="text-[length:var(--font-body)] text-gray-500 dark:text-gray-400 mb-6">
                  Your subscription has been activated successfully.
                </p>
                
                {paymentDetails && (
                  <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Payment Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Session ID:</span>
                        <span className="text-gray-900 dark:text-white font-mono text-xs">
                          {paymentDetails.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Status:</span>
                        <span className="text-gray-900 dark:text-white">
                          {getStatusBadge(paymentDetails.payment_status)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                        <span className="text-gray-900 dark:text-white font-semibold">
                          {formatCurrency(paymentDetails.amount_total, paymentDetails.currency)}
                        </span>
                      </div>
                      {paymentDetails.customer_email && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Email:</span>
                          <span className="text-gray-900 dark:text-white">
                            {paymentDetails.customer_email}
                          </span>
                        </div>
                      )}
                      {paymentDetails.metadata && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-500 dark:text-gray-400 block mb-1">Metadata:</span>
                          <div className="bg-white dark:bg-gray-800 rounded p-2 space-y-1">
                            {Object.entries(paymentDetails.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                                <span className="text-gray-900 dark:text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    loadPayments();
                  }}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setShowErrorModal(false)} />
            
            <div className="inline-block w-full max-w-md px-6 py-8 my-8 overflow-hidden text-center align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                  <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Payment Failed
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
