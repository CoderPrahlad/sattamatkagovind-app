'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGameStore } from '@/store';
import { InputField } from './AdminShared';

export default function AdminNotificationsView() {
  const { createNotification } = useGameStore();
  const [form, setForm] = useState({ title: '', message: '', type: 'info', userId: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!form.title || !form.message) return;
    setSending(true);
    setSent(false);
    await createNotification({ title: form.title, message: form.message, type: form.type, userId: form.userId || undefined });
    setSending(false);
    setSent(true);
    setForm({ title: '', message: '', type: 'info', userId: '' });
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-800/50">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center"><Bell className="w-4 h-4 text-yellow-400" /></div>
            <div>
              <h3 className="text-sm font-semibold text-white">Send Notification</h3>
              <p className="text-[11px] text-gray-500">Broadcast to all users or target a specific user</p>
            </div>
          </div>
          {sent && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm">
              <CheckCircle2 className="w-4 h-4" /><span>Notification sent successfully!</span>
            </div>
          )}
          <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Enter notification title" required />
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Message *</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3}
              placeholder="Enter notification message..."
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="offer">Offer</option>
              </select>
            </div>
            <InputField label="User ID (optional)" value={form.userId} onChange={(v) => setForm({ ...form, userId: v })} placeholder="Leave empty for global" />
          </div>
          <div className="flex items-center gap-2">
            {!form.userId && <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px]">Global broadcast</Badge>}
            {form.userId && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">Targeted</Badge>}
          </div>
          <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white" disabled={sending || !form.title || !form.message} onClick={handleSend}>
            <Send className="w-4 h-4 mr-2" />{sending ? 'Sending...' : 'Send Notification'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
