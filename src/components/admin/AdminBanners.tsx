'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGameStore } from '@/store';
import { InputField } from './AdminShared';

export default function AdminBannersView() {
  const { banners, createBanner, updateBanner, deleteBanner, fetchBanners } = useGameStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', ctaText: '', ctaLink: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  const handleSave = async () => {
    if (!editId) return;
    setSaving(true);
    await updateBanner(editId, form);
    setSaving(false);
    setEditId(null);
  };

  const handleAdd = async () => {
    if (!form.title) return;
    setSaving(true);
    await createBanner(form);
    setSaving(false);
    setShowAdd(false);
    setForm({ title: '', subtitle: '', ctaText: '', ctaLink: '', imageUrl: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white" onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ title: '', subtitle: '', ctaText: '', ctaLink: '', imageUrl: '' }); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Banner
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-gray-900 border-emerald-500/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">New Banner</h3>
            <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
            <InputField label="Subtitle" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="CTA Text" value={form.ctaText} onChange={(v) => setForm({ ...form, ctaText: v })} />
              <InputField label="CTA Link" value={form.ctaLink} onChange={(v) => setForm({ ...form, ctaLink: v })} />
            </div>
            <InputField label="Image URL" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-400" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" className="bg-emerald-500 text-white" disabled={saving || !form.title} onClick={handleAdd}>{saving ? 'Creating...' : 'Create'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editId && (
        <Card className="bg-gray-900 border-yellow-500/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Edit Banner</h3>
            <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <InputField label="Subtitle" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="CTA Text" value={form.ctaText} onChange={(v) => setForm({ ...form, ctaText: v })} />
              <InputField label="CTA Link" value={form.ctaLink} onChange={(v) => setForm({ ...form, ctaLink: v })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-400" onClick={() => setEditId(null)}>Cancel</Button>
              <Button size="sm" className="bg-emerald-500 text-white" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(banners || []).length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No banners</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => (
            <Card key={b.id} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-150">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    {b.subtitle && <p className="text-xs text-gray-400">{b.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs h-7 px-2" onClick={() => { setEditId(b.id); setForm({ title: b.title, subtitle: b.subtitle || '', ctaText: b.ctaText || '', ctaLink: b.ctaLink || '', imageUrl: b.imageUrl || '' }); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs h-7 px-2" onClick={async () => { if (confirm('Delete banner?')) await deleteBanner(b.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
