'use client';

import React, { useState, useEffect } from 'react';
import { Headphones, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import { StatusBadge } from './AdminShared';

export default function AdminTicketsView({ loaded }: { loaded?: boolean }) {
  const { adminTickets, fetchAdminTickets, updateTicket } = useGameStore();
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => { fetchAdminTickets(filter || undefined); }, [filter, fetchAdminTickets]);

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setReplying(true);
    await updateTicket(ticketId, { adminReply: replyText.trim() });
    setReplyText('');
    setReplying(false);
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    await updateTicket(ticketId, { status });
  };

  const ticketsList = adminTickets || [];
  const openCount = ticketsList.filter(t => t.status === 'open').length;

  // Show skeleton while initial data is loading
  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-lg bg-gray-800/50" />
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-gray-800/50" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === s ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:bg-gray-800'}`}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
        {openCount > 0 && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{openCount} open</Badge>}
      </div>

      {ticketsList.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><Headphones className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No tickets found</p></CardContent></Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto">
          {ticketsList.map((ticket) => {
            const isExpanded = expandedId === ticket.id;
            const typeColors: Record<string, string> = { deposit: 'bg-yellow-500/20 text-yellow-400', withdrawal: 'bg-orange-500/20 text-orange-400', game: 'bg-sky-500/20 text-sky-400', account: 'bg-purple-500/20 text-purple-400', general: 'bg-gray-700 text-gray-300' };
            return (
              <Card key={ticket.id} className={`bg-gray-900 ${isExpanded ? 'border-emerald-500/30' : 'border-gray-800/50 hover:border-gray-700/50'} transition-colors duration-150`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : ticket.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{ticket.subject}</p>
                        <Badge className={`text-[9px] ${typeColors[ticket.type] || typeColors.general}`}>{ticket.type}</Badge>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{ticket.user?.name} ({ticket.user?.mobile}) &bull; {new Date(ticket.createdAt).toLocaleString('en-IN')}</p>
                      {!isExpanded && <p className="text-xs text-gray-400 mt-1 truncate">{ticket.message}</p>}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-gray-800/50 pt-3">
                      <div className="bg-gray-800/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">User Message:</p>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{ticket.message}</p>
                      </div>

                      {ticket.adminReply && (
                        <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/10">
                          <p className="text-xs text-emerald-500 mb-1">Admin Reply:</p>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{ticket.adminReply}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..."
                          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 min-h-[60px]" />
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" className="bg-emerald-500 text-white" onClick={() => handleReply(ticket.id)} disabled={replying || !replyText.trim()}>
                            <Send className="w-3.5 h-3.5 mr-1" />{replying ? 'Sending...' : 'Send Reply'}
                          </Button>
                          <select value={ticket.status} onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                            className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs">
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
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
