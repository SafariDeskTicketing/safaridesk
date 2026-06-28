import React, { useState, useEffect } from 'react';
import { Shield, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import http from '../../services/http';
import { errorNotification, successNotification } from '../../components/ui/Toast';

interface SecurityTabProps {
    formData: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    };
    handleInputChange: (field: string, value: string) => void;
    handlePasswordChange: (e: React.FormEvent) => void;
    loadingPasswordChange: boolean;
}

const SecurityTab: React.FC<SecurityTabProps> = ({
    formData,
    handleInputChange,
    handlePasswordChange,
    loadingPasswordChange,
}) => {
    const [mfaMethod, setMfaMethod] = useState<string>('none');
    const [totpConfigured, setTotpConfigured] = useState(false);
    const [showTotpSetup, setShowTotpSetup] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [totpSecret, setTotpSecret] = useState<string | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [loadingMfa, setLoadingMfa] = useState(false);
    const [savingMfa, setSavingMfa] = useState(false);

    // Fetch MFA preference on mount
    useEffect(() => {
        const fetchMfaPreference = async () => {
            try {
                const response = await http.get('/auth/mfa/preference/');
                setMfaMethod(response.data.mfa_method || 'none');
                setTotpConfigured(response.data.totp_configured || false);
            } catch (error) {
                console.error('Failed to fetch MFA preference:', error);
            }
        };
        fetchMfaPreference();
    }, []);

    const handleSetupTotp = async () => {
        setLoadingMfa(true);
        try {
            const response = await http.post('/auth/mfa/setup-totp/');
            setQrCode(response.data.qr_code);
            setTotpSecret(response.data.secret);
            setShowTotpSetup(true);
        } catch (error) {
            errorNotification('Failed to generate QR code');
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleVerifyTotp = async () => {
        if (verifyCode.length !== 6) {
            errorNotification('Please enter a 6-digit code');
            return;
        }
        setLoadingMfa(true);
        try {
            await http.post('/auth/mfa/verify-totp/', { code: verifyCode });
            setTotpConfigured(true);
            setMfaMethod('totp');
            setShowTotpSetup(false);
            setQrCode(null);
            setTotpSecret(null);
            setVerifyCode('');
            successNotification('Authenticator App configured successfully!');
        } catch (error: any) {
            errorNotification(error?.response?.data?.error || 'Invalid code');
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleDisableTotp = async () => {
        setLoadingMfa(true);
        try {
            await http.post('/auth/mfa/disable-totp/');
            setTotpConfigured(false);
            setMfaMethod('none');
            successNotification('Authenticator App disabled');
        } catch (error) {
            errorNotification('Failed to disable TOTP');
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleMfaMethodChange = async (method: string) => {
        if (method === 'totp' && !totpConfigured) {
            handleSetupTotp();
            return;
        }
        setSavingMfa(true);
        try {
            await http.put('/auth/mfa/preference/', { mfa_method: method });
            setMfaMethod(method);
            successNotification('MFA preference updated');
        } catch (error: any) {
            errorNotification(error?.response?.data?.error || 'Failed to update MFA preference');
        } finally {
            setSavingMfa(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Change Password - First */}
            <Card className="p-5 sm:p-6">
                <h2 className="mb-5 flex items-center text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
                    <Shield className="w-5 h-5 mr-2" />
                    Change Password
                </h2>
                <form onSubmit={handlePasswordChange}>
                    <div className="space-y-4 max-w-md">
                        <Input
                            label="Current Password"
                            type="password"
                            value={formData.currentPassword}
                            onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                            placeholder="Enter current password"
                        />
                        <Input
                            label="New Password"
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) => handleInputChange('newPassword', e.target.value)}
                            placeholder="Enter new password"
                        />
                        <Input
                            label="Confirm New Password"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            placeholder="Confirm new password"
                        />
                        <div className="pt-4">
                            <Button type="submit" loading={loadingPasswordChange} disabled={loadingPasswordChange}>
                                <Shield className="w-4 h-4 mr-2" />
                                Change Password
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>

            {/* MFA Settings - Below Change Password */}
            <Card className="p-5 sm:p-6">
                <h2 className="mb-2 flex items-center text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
                    <Shield className="w-5 h-5 mr-2" />
                    Two-Factor Authentication
                </h2>
                <p className="mb-6 text-[length:var(--font-body)] text-[var(--text-secondary)]">
                    Add an extra layer of security to your account
                </p>

                <div className="space-y-4">
                    {/* MFA Method Options */}
                    <div className="space-y-3">
                        {/* None */}
                        <label className={`flex cursor-pointer items-center rounded-[var(--shell-radius)] border p-4 transition-all ${mfaMethod === 'none' ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]' : 'border-[var(--border-color)] hover:border-[var(--shell-search-border)]'}`}>
                            <input
                                type="radio"
                                name="mfaMethod"
                                checked={mfaMethod === 'none'}
                                onChange={() => handleMfaMethodChange('none')}
                                disabled={savingMfa}
                                className="h-4 w-4 text-primary-600"
                            />
                            <div className="ml-3">
                                <p className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>Disabled</p>
                                <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">No two-factor authentication (not recommended)</p>
                            </div>
                        </label>

                        {/* Email OTP */}
                        <label className={`flex cursor-pointer items-center rounded-[var(--shell-radius)] border p-4 transition-all ${mfaMethod === 'email' ? 'border-[var(--status-info-border)] bg-[var(--status-info-bg)]' : 'border-[var(--border-color)] hover:border-[var(--shell-search-border)]'}`}>
                            <input
                                type="radio"
                                name="mfaMethod"
                                checked={mfaMethod === 'email'}
                                onChange={() => handleMfaMethodChange('email')}
                                disabled={savingMfa}
                                className="w-4 h-4 text-primary-600"
                            />
                            <div className="ml-3 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 shrink-0 leading-none">
                                        <Mail className="h-4 w-4 text-[var(--status-info-text)]" />
                                    </span>
                                    <p className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>Email OTP</p>
                                </div>
                                <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">Receive a code via email each time you log in</p>
                            </div>
                        </label>

                        {/* Authenticator App */}
                        <label className={`flex cursor-pointer items-center rounded-[var(--shell-radius)] border p-4 transition-all ${mfaMethod === 'totp' ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)]' : 'border-[var(--border-color)] hover:border-[var(--shell-search-border)]'}`}>
                            <input
                                type="radio"
                                name="mfaMethod"
                                checked={mfaMethod === 'totp'}
                                onChange={() => handleMfaMethodChange('totp')}
                                disabled={savingMfa || loadingMfa}
                                className="w-4 h-4 text-primary-600"
                            />
                            <div className="ml-3 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 shrink-0 leading-none">
                                        <Shield className="w-4 h-4 text-primary-600" />
                                    </span>
                                    <p className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>Authenticator App</p>
                                    {totpConfigured && <Badge variant="success">Configured</Badge>}
                                </div>
                                <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">Use Google Authenticator, Authy, or similar app</p>
                            </div>
                            {totpConfigured && mfaMethod === 'totp' && (
                                <Button variant="outline" size="sm" onClick={handleDisableTotp} disabled={loadingMfa}>
                                    Remove
                                </Button>
                            )}
                        </label>
                    </div>

                    {/* TOTP Setup Flow */}
                    {showTotpSetup && (
                        <div className="mt-6 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-6">
                            <h3 className="mb-4 text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>Set up Authenticator App</h3>

                            <div className="space-y-4">
                                <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
                                    1. Install an authenticator app (Google Authenticator, Authy, etc.)
                                </p>

                                {qrCode && (
                                    <div className="flex flex-col items-center rounded-lg bg-white p-4">
                                        <p className="mb-3 text-[length:var(--font-body)] text-[var(--text-secondary)]">2. Scan this QR code:</p>
                                        <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
                                        {totpSecret && (
                                            <div className="mt-3 text-center">
                                                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">Or enter manually:</p>
                                                <code className="rounded bg-[var(--surface-subtle)] px-2 py-1 text-[length:var(--font-body)] font-mono">{totpSecret}</code>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <p className="mb-2 text-[length:var(--font-body)] text-[var(--text-secondary)]">3. Enter the 6-digit code from your app:</p>
                                    <div className="flex gap-3">
                                        <Input
                                            type="text"
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            maxLength={6}
                                            className="text-center text-lg tracking-widest font-mono max-w-32"
                                        />
                                        <Button onClick={handleVerifyTotp} loading={loadingMfa} disabled={verifyCode.length !== 6}>
                                            Verify
                                        </Button>
                                        <Button variant="outline" onClick={() => { setShowTotpSetup(false); setQrCode(null); }}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default SecurityTab;
