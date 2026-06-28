import React from "react";
import Button from "../ui/Button";
import { Input } from "../ui/Input";

export const BusinessSettings: React.FC = () => {
  return (
    <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6">
        Business Settings
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">
            Company Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Company Name" defaultValue="Acme Corporation" />
            <Input label="Industry" defaultValue="Technology" />
            <Input label="Phone Number" defaultValue="+1 (555) 123-4567" />
            <Input label="Website" defaultValue="https://acme.com" />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">
            Address
          </h3>
          <div className="space-y-4">
            <Input
              label="Street Address"
              defaultValue="123 Business St"
              fullWidth
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="City" defaultValue="San Francisco" />
              <Input label="State/Province" defaultValue="CA" />
              <Input label="ZIP/Postal Code" defaultValue="94105" />
            </div>
            <Input label="Country" defaultValue="United States" fullWidth />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">
            Business Hours
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Start Time" type="time" defaultValue="09:00" />
            <Input label="End Time" type="time" defaultValue="17:00" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

