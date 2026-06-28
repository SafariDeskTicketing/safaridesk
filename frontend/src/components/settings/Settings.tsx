import React, { useState, useEffect } from 'react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { Input } from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Loader } from '../loader/loader';
import { RefreshCw } from 'lucide-react';
import { successNotification, errorNotification } from '../ui/Toast';

interface TemplateSet {
  id: number;
  name: string;
}

interface SignatureSettings {
  signature_greeting: string;
  signature_name: string;
  include_ticket_link: boolean;
  use_plain_text: boolean;
}

export const Settings: React.FC = () => {
  const [templateSets, setTemplateSets] = useState<TemplateSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [configData, setConfigData] = useState({
    defaultTemplateSet: '',
    emailFetching: false,
  });

  const [signatureData, setSignatureData] = useState<SignatureSettings>({
    signature_greeting: 'Regards,',
    signature_name: '',
    include_ticket_link: false,
    use_plain_text: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configResponse = await http.get(APIS.EMAIL_CONFIG);
        setConfigData({
          defaultTemplateSet: configResponse.data.default_template?.toString() || '',
          emailFetching: configResponse.data.email_fetching || false,
        });

        const signatureResponse = await http.get(APIS.EMAIL_SIGNATURE);
        setSignatureData({
          signature_greeting: signatureResponse.data.signature_greeting || 'Regards,',
          signature_name: signatureResponse.data.signature_name || '',
          include_ticket_link: signatureResponse.data.include_ticket_link || false,
          use_plain_text: signatureResponse.data.use_plain_text || false,
        });

        const templatesResponse = await http.get(APIS.LOAD_EMAIL_TEMPLATES);
        setTemplateSets(templatesResponse.data.results || []);
      } catch (error) {
        console.error('Error fetching settings:', error);
        errorNotification('Failed to load email settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await http.put(APIS.EMAIL_CONFIG, {
        default_template: configData.defaultTemplateSet,
        email_fetching: configData.emailFetching,
      });

      await http.put(APIS.EMAIL_SIGNATURE, signatureData);

      successNotification('Email settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      errorNotification('Failed to save email settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="text-sm px-4 md:px-8 py-4 flex justify-center">
      <div className="w-full max-w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-[var(--border-color)] p-6 space-y-6">

        {/* General Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">General</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">Template Set:</label>
              <div className="w-48">
                <Select
                  value={configData.defaultTemplateSet}
                  onChange={(value) => setConfigData({ ...configData, defaultTemplateSet: value })}
                  options={templateSets.map(ts => ({ value: ts.id.toString(), label: ts.name }))}
                  placeholder="Select template"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">Email Fetching:</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={configData.emailFetching}
                  onChange={(e) => setConfigData({ ...configData, emailFetching: e.target.checked })}
                  className="rounded h-3 w-3 text-primary-600"
                  aria-label="Enable Email Fetching"
                />
                <span className="ml-1 text-xs text-gray-600 dark:text-gray-300">Enable</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Settings */}
        <div className="border-t border-gray-200 dark:border-[var(--border-color)] pt-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Email Signature</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Appears at the end of all outgoing emails.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">Greeting:</label>
              <div className="w-48">
                <Input
                  value={signatureData.signature_greeting}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSignatureData({ ...signatureData, signature_greeting: e.target.value })
                  }
                  placeholder="Regards,"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex items-start gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">Name:</label>
              <div className="w-48">
                <Input
                  value={signatureData.signature_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSignatureData({ ...signatureData, signature_name: e.target.value })
                  }
                  placeholder="Support Team"
                  className="text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Blank = business name</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="border-t border-gray-200 dark:border-[var(--border-color)] pt-6">
          <div className="flex items-start gap-4">
            <label className="w-32 text-sm font-semibold text-gray-900 dark:text-gray-100 pt-2">Preview:</label>
            <div className="w-48">
              <div className="bg-gray-50 dark:bg-[var(--app-bg)] p-3 rounded text-sm text-gray-700 dark:text-gray-300">
                <p>{signatureData.signature_greeting}</p>
                <p className="font-semibold">{signatureData.signature_name || '(Your Business Name)'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-6 border-t border-gray-200 dark:border-[var(--border-color)] flex justify-end">
          <Button onClick={handleSaveChanges} disabled={isSaving} size="sm" className="h-8 px-4 text-sm">
            {isSaving ? <RefreshCw className="animate-spin h-3 w-3" /> : 'Save Changes'}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
};
