import React, { useEffect, useMemo, useState } from 'react';

type ContactRequest = {
  fields: string[];
  invalid?: Record<string, string>;
};

type ContactValues = {
  name?: string;
  email?: string;
  phone?: string;
};

type Props = {
  request: ContactRequest;
  value?: ContactValues;
  onChange?: (contact: ContactValues) => void;
  onSubmit: (contact: ContactValues) => void;
};

const labelMap: Record<string, string> = {
  name: 'Full name',
  email: 'Email',
  phone: 'Phone number',
};

const ChatContactPrompt: React.FC<Props> = ({ request, value, onChange, onSubmit }) => {
  const [name, setName] = useState(value?.name ?? '');
  const [email, setEmail] = useState(value?.email ?? '');
  const [phone, setPhone] = useState(value?.phone ?? '');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');

  const fields = useMemo(() => request.fields || [], [request.fields]);
  const invalid = request.invalid || {};

  useEffect(() => {
    setName(value?.name ?? '');
    setEmail(value?.email ?? '');
    setPhone(value?.phone ?? '');
  }, [value?.name, value?.email, value?.phone]);

  useEffect(() => {
    if (Object.keys(invalid).length > 0) {
      setStep('edit');
    }
  }, [invalid]);

  const handleNameChange = (next: string) => {
    setName(next);
    onChange?.({ name: next, email, phone });
  };

  const handleEmailChange = (next: string) => {
    setEmail(next);
    onChange?.({ name, email: next, phone });
  };

  const handlePhoneChange = (next: string) => {
    setPhone(next);
    onChange?.({ name, email, phone: next });
  };

  const handleSubmit = () => {
    onSubmit({
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
    });
    setStep('edit');
  };

  const isComplete = fields.every((field) => {
    if (field === 'name') return !!name.trim();
    if (field === 'email') return !!email.trim();
    if (field === 'phone') return !!phone.trim();
    return true;
  });

  return (
    <div className="border border-gray-200 dark:border-subtle rounded-lg p-3 space-y-3 bg-gray-50 dark:bg-surface-elevated">
      {step === 'edit' ? (
        <>
          <div className="text-sm text-gray-800 dark:text-[var(--text-primary)] font-medium">Enter your details to continue</div>
          {fields.includes('name') && (
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-[var(--text-primary)]">{labelMap.name}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-surface border-gray-300 dark:border-subtle"
                placeholder="Your name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              {invalid.name && <div className="text-xs text-red-600">{invalid.name}</div>}
            </div>
          )}
          {fields.includes('email') && (
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-[var(--text-primary)]">{labelMap.email}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-surface border-gray-300 dark:border-subtle"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
              />
              {invalid.email && <div className="text-xs text-red-600">{invalid.email}</div>}
            </div>
          )}
          {fields.includes('phone') && (
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-[var(--text-primary)]">{labelMap.phone}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-surface border-gray-300 dark:border-subtle"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              {invalid.phone && <div className="text-xs text-red-600">{invalid.phone}</div>}
            </div>
          )}
          <div className="flex justify-end">
            <button
              className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
              onClick={() => setStep('confirm')}
              disabled={!fields.length || !isComplete}
            >
              Review details
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-800 dark:text-[var(--text-primary)] font-medium">Confirm your details</div>
          <div className="text-xs text-gray-600 dark:text-[var(--text-primary)] space-y-1">
            {fields.includes('name') && <div><span className="font-medium">Name:</span> {name || '—'}</div>}
            {fields.includes('email') && <div><span className="font-medium">Email:</span> {email || '—'}</div>}
            {fields.includes('phone') && <div><span className="font-medium">Phone:</span> {phone || '—'}</div>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="border border-gray-300 dark:border-subtle text-gray-700 dark:text-[var(--text-primary)] text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-surface-hover"
              onClick={() => setStep('edit')}
            >
              Edit
            </button>
            <button
              className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
              onClick={handleSubmit}
              disabled={!fields.length || !isComplete}
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatContactPrompt;
