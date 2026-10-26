import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { projectApi } from '../../services/api';
import { Card, Button, Avatar, Skeleton, Badge } from '../ui';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { useMessageNotifications, requestNotificationPermission } from '../../hooks/useMessageNotifications';
import {
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  Sparkles,
  Lock,
  CheckCircle2,
} from 'lucide-react';

export const ProjectDiscussionsTab = ({
  projectId,
  isMember,
  isLead,
  isActive = true,
  onUnreadChange,
}) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);
  const feedContainerRef = useRef(null);

  // Poll for new messages every 8 seconds per spec
  const {
    data: messages = [],
    isLoading,
    isRefetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['project-messages', projectId],
    queryFn: () => projectApi.getMessages(projectId),
    refetchInterval: 8000,
    staleTime: 5000,
  });

  // Out-of-focus desktop notifications, title flashing, and navigation badge sync
  useMessageNotifications({
    messages,
    currentUser,
    isActive,
    onUnreadChange,
  });

  // Request browser notification permissions when opening or interacting with project discussion
  useEffect(() => {
    if (isActive) {
      requestNotificationPermission();
    }
  }, [isActive]);

  // Mutation for sending a message
  const sendMutation = useMutation({
    mutationFn: (content) => projectApi.sendMessage(projectId, content),
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['project-messages', projectId] });
      scrollToBottom();
    },
    onError: (err) => {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to send message';
      toast.error(errMsg);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed) return;
    if (!canPost) {
      toast.error('Only project members and leads can post messages');
      return;
    }
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canPost = isMember || isLead || currentUser?.role === 'professor' || currentUser?.role === 'admin';

  return (
    <div className="space-y-4">
      {/* Discussion Container Card */}
      <Card className="flex flex-col h-[720px] overflow-hidden border border-border bg-surface-1 shadow-card">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-border bg-surface-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text">
              <MessageSquare className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text">Project Discussions</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-3">
                  {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>
              <p className="text-[11px] text-text-3">
                Real-time team chat & collaboration stream
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Polling Indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[11px] text-text-3 font-mono"
              title="TanStack Query polling active (every 8s)"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span>Live (8s)</span>
            </div>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={() => refetch()}
              disabled={isRefetching}
              className={`p-2 ${isRefetching ? 'animate-spin text-primary' : 'text-text-3 hover:text-text'}`}
              title="Manual refresh"
            />
          </div>
        </div>

        {/* Message Feed Area */}
        <div
          ref={feedContainerRef}
          className="flex-1 overflow-y-auto p-5 space-y-4 bg-bg/50"
        >
          {isLoading ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`flex items-start gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="space-y-2 max-w-[60%] w-full">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-16 w-full rounded-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
                <MessageSquare className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">Failed to load messages</p>
                <p className="text-xs text-text-3 mt-1">
                  {error?.response?.data?.error?.message || error?.message || 'Access restricted or network issue'}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-3">
                <Sparkles className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div className="max-w-sm space-y-1">
                <h4 className="text-sm font-semibold text-text">No discussion messages yet</h4>
                <p className="text-xs text-text-3 leading-relaxed">
                  Start the conversation! Coordinate experiments, share findings, or post updates with your research team.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = currentUser && currentUser.id === msg.sender_id;
              const formattedDate = msg.created_at ? new Date(msg.created_at) : new Date();
              const relativeTime = formatDistanceToNow(formattedDate, { addSuffix: true });
              const absoluteTime = format(formattedDate, 'MMM d, yyyy • h:mm a');

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 group transition-opacity duration-150 ${
                    isSelf ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Sender Avatar */}
                  <Avatar
                    name={msg.sender_name || 'Member'}
                    size="sm"
                    className="shrink-0 mt-0.5 border-border"
                  />

                  {/* Message Bubble Column */}
                  <div className={`max-w-[80%] sm:max-w-[70%] space-y-1.5 ${isSelf ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`flex items-center gap-2 text-[11px] ${
                        isSelf ? 'flex-row-reverse text-right' : 'flex-row'
                      }`}
                    >
                      <span className="font-medium text-text">
                        {isSelf ? 'You' : msg.sender_name}
                      </span>
                      <span
                        className="text-text-3 font-mono cursor-default"
                        title={absoluteTime}
                      >
                        {relativeTime}
                      </span>
                    </div>

                    {/* Bubble Content */}
                    <div
                      className={`rounded-[12px] p-3.5 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap border shadow-sm ${
                        isSelf
                          ? 'bg-surface-2 border-border-strong text-text rounded-tr-sm'
                          : 'bg-surface-1 border-border text-text rounded-tl-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer Section */}
        <div className="p-4 border-t border-border bg-surface-1 shrink-0">
          {!canPost ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-[8px] bg-surface-2 border border-border text-xs text-text-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 stroke-[1.75]" />
                <span>You have viewer access. Only project members and leads can post messages.</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-2.5">
              <div className="relative">
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={requestNotificationPermission}
                  onClick={requestNotificationPermission}
                  placeholder="Write a message... (Press Enter to send, Shift+Enter for newline)"
                  disabled={sendMutation.isPending}
                  className="w-full bg-surface-2 border border-border rounded-[8px] p-3 text-xs sm:text-sm text-text placeholder:text-text-3 transition-colors duration-150 focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-3 flex items-center gap-1 font-mono">
                  <span>Press <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border text-text-2">Enter ↵</kbd> to send</span>
                  <span className="mx-1">•</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border text-text-2">Shift+Enter</kbd> for newline</span>
                </span>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={Send}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  isLoading={sendMutation.isPending}
                >
                  Send
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
};
