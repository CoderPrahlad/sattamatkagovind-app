'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, ToggleLeft, ToggleRight, QrCode, CreditCard, Settings, Image as ImageIcon, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';
import { InputField } from './AdminShared';

export default function AdminConfigView() {
  const { adminConfigs, fetchAdminConfigs, updateAdminConfigs } = useGameStore();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrPreview, setQrPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminConfigs();
  }, [fetchAdminConfigs]);

  // Initialize QR preview when config loads
  useEffect(() => {
    const currentQr = getConfigValue('qr_code_url', '');
    if (currentQr) setQrPreview(currentQr);
  }, [adminConfigs]);

  const getConfigValue = (key: string, defaultValue: string) => {
    if (editValues[key] !== undefined) return editValues[key];
    const found = adminConfigs.find(c => c.key === key);
    return found ? found.value : defaultValue;
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'qr');
      const token = useGameStore.getState().authToken;
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        setEditValues(prev => ({ ...prev, qr_code_url: json.data.url }));
        setQrPreview(json.data.url);
        toast({ title: 'QR Uploaded', description: 'QR code image uploaded successfully' });
      } else {
        toast({ title: 'Upload Failed', description: json.error || 'Failed to upload QR code', variant: 'destructive' });
      }
    } catch (err) {
      console.error('QR upload failed:', err);
      toast({ title: 'Upload Error', description: 'Failed to upload QR code. Please try again.', variant: 'destructive' });
    } finally {
      setUploadingQr(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    const allEntries = Object.entries(editValues);
    if (allEntries.length === 0) return;
    const configs = allEntries.map(([key, value]) => ({ key, value }));
    setSaving(true);
    await updateAdminConfigs(configs);
    setSaving(false);
  };

  const handleSaveSocial = async () => {
    const socialConfigs = [
      { key: 'whatsapp_number', value: editValues['whatsapp_number'] ?? getConfigValue('whatsapp_number', '919999999999') },
      { key: 'telegram_link', value: editValues['telegram_link'] ?? getConfigValue('telegram_link', '') },
      { key: 'telegram_enabled', value: editValues['telegram_enabled'] ?? getConfigValue('telegram_enabled', 'false') },
    ];
    setSaving(true);
    await updateAdminConfigs(socialConfigs);
    setSaving(false);
  };

  const handleSavePayment = async () => {
    const paymentConfigs = [
      { key: 'upi_id', value: editValues['upi_id'] ?? getConfigValue('upi_id', '') },
      { key: 'qr_code_url', value: editValues['qr_code_url'] ?? getConfigValue('qr_code_url', '') },
      { key: 'payment_methods', value: editValues['payment_methods'] ?? getConfigValue('payment_methods', 'upi,bank_transfer') },
      { key: 'min_deposit_amount', value: editValues['min_deposit_amount'] ?? getConfigValue('min_deposit_amount', '200') },
    ];
    setSaving(true);
    await updateAdminConfigs(paymentConfigs);
    setSaving(false);
  };

  const handleSaveReferral = async () => {
    const referralConfigs = [
      { key: 'referral_bonus_enabled', value: editValues['referral_bonus_enabled'] ?? getConfigValue('referral_bonus_enabled', 'true') },
      { key: 'referral_bonus_percentage', value: editValues['referral_bonus_percentage'] ?? getConfigValue('referral_bonus_percentage', '10') },
      { key: 'referral_bonus_max_amount', value: editValues['referral_bonus_max_amount'] ?? getConfigValue('referral_bonus_max_amount', '50') },
    ];
    setSaving(true);
    await updateAdminConfigs(referralConfigs);
    setSaving(false);
  };

  const whatsappNumber = getConfigValue('whatsapp_number', '919999999999');
  const telegramLink = getConfigValue('telegram_link', '');
  const telegramEnabled = getConfigValue('telegram_enabled', 'false') === 'true';

  const upiId = getConfigValue('upi_id', '');
  const qrCodeUrl = getConfigValue('qr_code_url', '');
  const paymentMethods = getConfigValue('payment_methods', 'upi,bank_transfer');
  const minDepositAmount = getConfigValue('min_deposit_amount', '200');

  return (
    <div className="space-y-4">
      {/* Social Links Section */}
      <Card className="bg-gray-900 border-emerald-500/20">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            Social Links
          </h3>
          <div className="space-y-3">
            <InputField
              label="WhatsApp Support Number"
              value={whatsappNumber}
              onChange={(v) => setEditValues({ ...editValues, whatsapp_number: v })}
              placeholder="919999999999 (with country code)"
            />
            <InputField
              label="Telegram Channel Link"
              value={telegramLink}
              onChange={(v) => setEditValues({ ...editValues, telegram_link: v })}
              placeholder="https://t.me/your_channel"
            />
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Telegram Enabled</label>
              <button
                onClick={() => setEditValues({ ...editValues, telegram_enabled: telegramEnabled ? 'false' : 'true' })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 w-full"
              >
                {telegramEnabled ? (
                  <ToggleRight className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-500" />
                )}
                <span className={`text-sm ${telegramEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </button>
            </div>
          </div>
          <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white" disabled={saving} onClick={handleSaveSocial}>
            {saving ? 'Saving...' : 'Save Social Links'}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Settings Section */}
      <Card className="bg-gray-900 border-yellow-500/20">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-yellow-400" />
            Payment Settings
          </h3>
          <div className="space-y-3">
            <InputField
              label="UPI ID (for deposits)"
              value={upiId}
              onChange={(v) => setEditValues({ ...editValues, upi_id: v })}
              placeholder="name@upi"
            />
            {/* QR Code Upload */}
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">QR Code Image</label>
              <div className="flex items-center gap-3">
                {qrPreview ? (
                  <div className="relative w-20 h-20 shrink-0 rounded-lg border border-gray-700 overflow-hidden bg-gray-800">
                    <img src={qrPreview} alt="QR Code" className="w-full h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => { setEditValues(prev => ({ ...prev, qr_code_url: '' })); setQrPreview(''); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-400"
                    >X</button>
                  </div>
                ) : (
                  <div className="w-20 h-20 shrink-0 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center bg-gray-800/50">
                    <QrCode className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${uploadingQr ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-wait' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-emerald-500/50 hover:text-emerald-400'}`}>
                  <ImageIcon className="w-4 h-4" />
                  {uploadingQr ? 'Uploading...' : qrPreview ? 'Change QR Code' : 'Upload QR Code'}
                  <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" disabled={uploadingQr} />
                </label>
              </div>
            </div>
            <InputField
              label="Payment Methods (comma separated)"
              value={paymentMethods}
              onChange={(v) => setEditValues({ ...editValues, payment_methods: v })}
              placeholder="upi,bank_transfer"
            />
            <InputField
              label="Minimum Deposit Amount (₹)"
              value={minDepositAmount}
              onChange={(v) => setEditValues({ ...editValues, min_deposit_amount: v })}
              placeholder="200"
              type="number"
            />
          </div>
          <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black" disabled={saving} onClick={handleSavePayment}>
            {saving ? 'Saving...' : 'Save Payment Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Other Configs */}
      {(adminConfigs || []).length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><Settings className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No other configs</p></CardContent></Card>
      ) : (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white mb-2">Other Configuration</h3>
            {adminConfigs
              .filter(c => !['whatsapp_number', 'telegram_link', 'telegram_enabled', 'upi_id', 'qr_code_url', 'payment_methods', 'min_deposit_amount', 'referral_bonus_enabled', 'referral_bonus_percentage', 'referral_bonus_max_amount', 'referral_bonus', 'referral_bonus_amount'].includes(c.key))
              .map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row gap-2">
                <div className="sm:w-40 shrink-0">
                  <label className="text-xs font-medium text-gray-400">{c.key}</label>
                </div>
                <input type="text" value={editValues[c.key] ?? c.value} onChange={(e) => setEditValues({ ...editValues, [c.key]: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
              </div>
            ))}
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save All'}</Button>
          </CardContent>
        </Card>
      )}

      {/* Referral Bonus Settings */}
      <Card className="bg-gray-900 border-purple-500/20">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-400" />
            Referral Bonus Settings
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Referral Bonus Enabled</label>
              <button
                onClick={() => setEditValues({ ...editValues, referral_bonus_enabled: getConfigValue('referral_bonus_enabled', 'true') === 'true' ? 'false' : 'true' })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 w-full"
              >
                {getConfigValue('referral_bonus_enabled', 'true') === 'true' ? (
                  <ToggleRight className="w-5 h-5 text-purple-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-500" />
                )}
                <span className={`text-sm ${getConfigValue('referral_bonus_enabled', 'true') === 'true' ? 'text-purple-400' : 'text-gray-500'}`}>
                  {getConfigValue('referral_bonus_enabled', 'true') === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </button>
              <p className="text-[11px] text-gray-500 mt-1">When enabled, referrer gets bonus when referred user&apos;s 1st recharge is approved</p>
            </div>
            <InputField
              label="Referral Bonus Percentage (%)"
              value={getConfigValue('referral_bonus_percentage', '10')}
              onChange={(v) => setEditValues({ ...editValues, referral_bonus_percentage: v })}
              placeholder="10"
              type="number"
            />
            <p className="text-[11px] text-gray-500 -mt-1">Percentage of recharge amount that referrer will receive as bonus</p>
            <InputField
              label="Max Referral Bonus (₹)"
              value={getConfigValue('referral_bonus_max_amount', '50')}
              onChange={(v) => setEditValues({ ...editValues, referral_bonus_max_amount: v })}
              placeholder="50"
              type="number"
            />
            <p className="text-[11px] text-gray-500 -mt-1">Maximum bonus amount (e.g. 10% of ₹200 = ₹20, but max ₹50)</p>
          </div>
          <Button className="w-full bg-purple-500 hover:bg-purple-400 text-white" disabled={saving} onClick={handleSaveReferral}>
            {saving ? 'Saving...' : 'Save Referral Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
