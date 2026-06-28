import { AlertTriangle, ExternalLink } from "lucide-react";
import { useState } from "react";

const DomainErrorComponent = () => {
 
  const currentDomain = window.location.hostname;

  

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-surface dark:to-surface-elevated p-4">
      <div className="max-w-md w-full">
        <div className="text-center p-8 bg-white dark:bg-surface-elevated rounded-xl shadow-2xl border border-gray-200 dark:border-subtle">
          {/* Error Icon */}
          <div className="mx-auto flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-4">
            Business Not Found
          </h2>

          {/* Description */}
          <div className="space-y-3 mb-6">
            <p className="text-gray-600 dark:text-[var(--text-primary)] leading-relaxed">
              We couldn't validate the business domain <span className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">{currentDomain}</span> in our system.
            </p>
            <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
              This could happen if:
            </p>
            <ul className="text-sm text-gray-500 dark:text-[var(--text-primary)] text-left space-y-1">
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                The URL is incorrect or misspelled
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                The support portal is not yet configured
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                Temporary network connectivity issues
              </li>
            </ul>
          </div>

         

          {/* Additional Help */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-subtle">
            <p className="text-xs text-gray-500 dark:text-[var(--text-primary)] mb-2">
              Need immediate assistance?
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs">
              <a
                href="https://docs.example.com/troubleshooting"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center transition-colors"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Documentation
              </a>
              <span className="text-gray-300 dark:text-[var(--text-primary)]">•</span>
              <a
                href="tel:+1234567890"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                Call Support
              </a>
            </div>
          </div>
        </div>

        {/* Technical Details (Collapsible) */}
        <details className="mt-4 bg-white dark:bg-surface-elevated rounded-lg shadow border border-gray-200 dark:border-subtle">
          <summary className="p-4 cursor-pointer text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover rounded-lg transition-colors">
            Technical Details
          </summary>
          <div className="px-4 pb-4 text-xs text-gray-500 dark:text-[var(--text-primary)] font-mono space-y-2">
            <div>
              <span className="font-semibold">Current URL:</span> {window.location.href}
            </div>
            <div>
              <span className="font-semibold">Domain:</span> {currentDomain}
            </div>
            <div>
              <span className="font-semibold">Timestamp:</span> {new Date().toISOString()}
            </div>
            <div>
              <span className="font-semibold">User Agent:</span> {navigator.userAgent.slice(0, 50)}...
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default DomainErrorComponent