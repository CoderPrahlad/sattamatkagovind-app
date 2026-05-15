'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Gamepad2, Pencil, Trash2, ToggleLeft, ToggleRight, Lock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';
import { isInClosingWindow, getCurrentTimeIST } from '@/lib/time';
import { InputField } from './AdminShared';

export default function AdminGamesView() {
  const { games, updateGame, createGame, deleteGame, navigate } = useGameStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', openTime: '', closeTime: '', isOpen: true, sortOrder: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', openTime: '', closeTime: '', sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [liveIST, setLiveIST] = useState('');

  useEffect(() => {
    const tick = () => {
      setLiveIST(getCurrentTimeIST());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const startEdit = (game: typeof games[0]) => {
    setEditingId(game.id);
    setEditForm({ name: game.name, openTime: game.openTime, closeTime: game.closeTime, isOpen: game.isOpen, sortOrder: game.sortOrder });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    // Send openTime, closeTime, and isOpen to the API
    const success = await updateGame(editingId, {
      openTime: editForm.openTime,
      closeTime: editForm.closeTime,
      isOpen: editForm.isOpen,
    } as Record<string, unknown>);
    setSaving(false);
    if (success) setEditingId(null);
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.openTime || !addForm.closeTime) return;
    setSaving(true);
    const success = await createGame(addForm);
    setSaving(false);
    if (success) {
      setShowAdd(false);
      setAddForm({ name: '', openTime: '', closeTime: '', sortOrder: 0 });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this game? This cannot be undone.')) return;
    setSaving(true);
    await deleteGame(id);
    setSaving(false);
  };

  const handleToggleActive = async (game: typeof games[0]) => {
    const success = await updateGame(game.id, { isOpen: !game.isOpen } as Record<string, unknown>);
    if (success) {
      toast({ title: game.isOpen ? 'Game Disabled' : 'Game Enabled', description: `${game.name} is now ${game.isOpen ? 'inactive' : 'active'}` });
    }
  };

  const handleViewBids = (gameId: string) => {
    useGameStore.setState({ bidFilterGameId: gameId, adminBids: [], adminBidsSummary: null });
    navigate('admin-bids');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Current IST:</span>
          <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded animate-pulse">{liveIST}</span>
        </div>
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-1" /> Add Game
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-gray-900 border-emerald-500/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-400" />New Game</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField label="Game Name" value={addForm.name} onChange={(v) => setAddForm({ ...addForm, name: v })} placeholder="e.g. Milan Day" required />
              <InputField label="Closing From (IST)" type="time" value={addForm.openTime} onChange={(v) => setAddForm({ ...addForm, openTime: v })} placeholder="e.g. 14:00" required />
              <InputField label="Closing Until (IST)" type="time" value={addForm.closeTime} onChange={(v) => setAddForm({ ...addForm, closeTime: v })} placeholder="e.g. 16:00" required />
              <InputField label="Sort Order" type="number" value={String(addForm.sortOrder)} onChange={(v) => setAddForm({ ...addForm, sortOrder: parseInt(v) || 0 })} placeholder="0" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-400" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" className="bg-emerald-500 text-white" disabled={saving || !addForm.name || !addForm.openTime || !addForm.closeTime} onClick={handleAdd}>{saving ? 'Creating...' : 'Create Game'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(games || []).length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><Gamepad2 className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No games configured</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const isEditing = editingId === game.id;
            const isAccepting = game.isOpen && !isInClosingWindow(game.openTime, game.closeTime);

            return (
              <Card key={game.id} className={`bg-gray-900 ${isEditing ? 'border-emerald-500/30' : 'border-gray-800/50 hover:border-gray-700/50'} transition-colors duration-200`}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      {/* Name - LOCKED */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1"><Lock className="w-3 h-3" /> Game Name (Locked)</label>
                        <input type="text" value={editForm.name} readOnly
                          className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-500 text-sm cursor-not-allowed" />
                      </div>
                      {/* Editable fields - Closing From, Closing Until */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                          <label className="text-xs font-medium text-amber-400 mb-1 block flex items-center gap-1"><Pencil className="w-3 h-3" /> Closing From</label>
                          <input type="time" step={60} value={editForm.openTime} onChange={(e) => setEditForm({ ...editForm, openTime: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                          <p className="text-[10px] text-gray-500 mt-1">Bidding band hone ka time (e.g. 2:00 PM)</p>
                        </div>
                        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                          <label className="text-xs font-medium text-amber-400 mb-1 block flex items-center gap-1"><Pencil className="w-3 h-3" /> Closing Until</label>
                          <input type="time" step={60} value={editForm.closeTime} onChange={(e) => setEditForm({ ...editForm, closeTime: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                          <p className="text-[10px] text-gray-500 mt-1">Bidding phir se open hoga (e.g. 4:00 PM)</p>
                        </div>
                      </div>
                      {/* Closing window preview */}
                      <p className="text-[10px] text-amber-400/70 bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                        Closing Window: {editForm.openTime} to {editForm.closeTime} IST — Is time par bidding band rahegi. Baaki time open rahega.
                      </p>
                      {/* Status toggle */}
                      <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                        <label className="text-xs font-medium text-amber-400 mb-2 block flex items-center gap-1"><Pencil className="w-3 h-3" /> Game Status</label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditForm({ ...editForm, isOpen: true })}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                              editForm.isOpen
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                            }`}
                          >
                            <ToggleRight className="w-4 h-4" />
                            Enable (Active)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditForm({ ...editForm, isOpen: false })}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                              !editForm.isOpen
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                            }`}
                          >
                            <ToggleLeft className="w-4 h-4" />
                            Disable (Offline)
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1.5">
                          {editForm.isOpen ? 'Game is active — users can see it and place bids during the bidding window.' : 'Game is offline — users cannot see or bid on this game.'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-500 text-white" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                        <Button size="sm" variant="outline" className="border-gray-700 text-gray-400" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isAccepting ? 'bg-emerald-500/20 border border-emerald-500/30 animate-pulse' : 'bg-gray-800 border border-gray-700'}`}>
                          <Gamepad2 className={`w-5 h-5 ${isAccepting ? 'text-emerald-400' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{game.name}</p>
                            <Badge className={`text-[10px] font-semibold ${isAccepting ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : game.isOpen ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : 'bg-gray-800 text-gray-500'}`}>
                              {isAccepting ? '● Open' : game.isOpen ? '● Closing' : '● Offline'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-gray-500">Closing: {game.openTime} - {game.closeTime} IST &bull; Bids: {game._count?.bids ?? 0} &bull; Results: {game._count?.results ?? 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="border-sky-500/30 text-sky-400 text-xs h-7 px-2" onClick={() => handleViewBids(game.id)} title="View Bids"><Eye className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" className={`text-xs h-7 px-2 ${game.isOpen ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-gray-600 text-gray-400 hover:bg-gray-700'}`} onClick={() => handleToggleActive(game)} title={game.isOpen ? 'Deactivate' : 'Activate'}>
                          {game.isOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs h-7 px-2" onClick={() => startEdit(game)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs h-7 px-2" onClick={() => handleDelete(game.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
