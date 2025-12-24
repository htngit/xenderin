'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageService, GroupService, ContactService } from '@/lib/services';
import { ConversationSummary, Message, InboxFilters, ContactGroup } from '@/lib/services/types';
import { syncManager } from '@/lib/sync/SyncManager';
import { ConversationList } from './ConversationList';
import { ChatWindow } from './ChatWindow';
import { ChatHeader } from './ChatHeader';
import { InboxFiltersPanel } from './InboxFilters';
import { cn } from '@/lib/utils';

interface IncomingWhatsAppMessage {
    id: string;
    from: string;
    to: string;
    body: string;
    type: string;
    timestamp: number;
    hasMedia: boolean;
    isUnsubscribeRequest?: boolean;
}

export function InboxPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const [messageService] = useState(() => new MessageService(syncManager));
    const [groupService] = useState(() => new GroupService(syncManager));
    const [contactService] = useState(() => new ContactService(syncManager));

    // State
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [filters, setFilters] = useState<InboxFilters>({});
    const [showFilters, setShowFilters] = useState(false);

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const convs = await messageService.getConversations(filters);
            setConversations(convs);
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }, [messageService, filters]);

    // Load messages for selected conversation
    const loadMessages = useCallback(async (phone: string) => {
        setIsLoadingMessages(true);
        try {
            const msgs = await messageService.getMessagesByPhone(phone);
            setMessages(msgs);

            // Mark as read
            const unreadIds = msgs
                .filter(m => m.direction === 'inbound' && m.status === 'received')
                .map(m => m.id);
            if (unreadIds.length > 0) {
                await messageService.markAsRead(unreadIds);
                loadConversations(); // Refresh to update unread counts
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [messageService, loadConversations]);

    // Initial load
    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                // Load groups and tags for filters
                const [grps, availableTags] = await Promise.all([
                    groupService.getGroups(),
                    messageService.getAvailableTags()
                ]);
                setGroups(grps);
                setTags(availableTags);

                // Load conversations
                await loadConversations();
            } catch (error) {
                console.error('Error initializing inbox:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [groupService, messageService, loadConversations]);

    // Handle incoming WhatsApp messages
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const handleIncomingMessage = async (data: unknown) => {
            const messageData = data as IncomingWhatsAppMessage;
            try {
                await messageService.createFromIncomingWhatsApp(messageData);
                await loadConversations();

                // If the message is from the currently selected conversation, reload messages
                if (selectedConversation) {
                    const normalizedPhone = messageData.from.replace('@c.us', '').replace(/[^\d]/g, '');
                    if (selectedConversation.contact_phone.replace(/[^\d]/g, '') === normalizedPhone) {
                        await loadMessages(selectedConversation.contact_phone);
                    }
                }
            } catch (error) {
                console.error('Error handling incoming message:', error);
            }
        };

        // Use the correct electron whatsapp API
        if (window.electron?.whatsapp?.onMessageReceived) {
            unsubscribe = window.electron.whatsapp.onMessageReceived(handleIncomingMessage);
        }

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [messageService, loadConversations, loadMessages, selectedConversation]);

    // Send Message
    const handleSendMessage = async (content: string) => {
        if (!selectedConversation) return;

        try {
            // 1. Send via WhatsApp (Electron)
            // Use type assertion to avoid TS errors
            const electron = (window as any).electron;
            if (!electron?.whatsapp?.sendMessage) {
                throw new Error('WhatsApp service not available');
            }

            const result = await electron.whatsapp.sendMessage(
                selectedConversation.contact_phone,
                content
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to send message');
            }

            // 2. Save to local DB
            await messageService.createOutboundMessage({
                contact_id: selectedConversation.contact_id || '',
                contact_phone: selectedConversation.contact_phone,
                contact_name: selectedConversation.contact_name,
                content: content
            });

            // 3. Refresh Messages
            await loadMessages(selectedConversation.contact_phone);

        } catch (error) {
            console.error('Failed to send message', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send message');
        }
    };

    // Handle conversation selection
    const handleSelectConversation = useCallback((conversation: ConversationSummary) => {
        setSelectedConversation(conversation);
        loadMessages(conversation.contact_phone);
    }, [loadMessages]);

    // Handle tag update
    const handleUpdateTags = useCallback(async (contactId: string, newTags: string[]) => {
        try {
            await contactService.updateContact(contactId, { tags: newTags });
            await loadConversations();

            // Update selected conversation if it's the one being updated
            if (selectedConversation?.contact_id === contactId) {
                setSelectedConversation(prev => prev ? { ...prev, contact_tags: newTags } : null);
            }
        } catch (error) {
            console.error('Error updating tags:', error);
        }
    }, [contactService, loadConversations, selectedConversation]);

    // Handle filter change
    const handleFilterChange = useCallback((newFilters: InboxFilters) => {
        setFilters(newFilters);
    }, []);

    // Apply filters effect
    useEffect(() => {
        loadConversations();
    }, [filters, loadConversations]);

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar: Conversation List */}
            <div className={cn(
                "flex flex-col border-r border-border",
                "w-full md:w-[380px] lg:w-[420px]",
                selectedConversation ? "hidden md:flex" : "flex"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="h-8 w-8"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-xl font-semibold">
                            {intl.formatMessage({ id: 'inbox.title', defaultMessage: 'Inbox' })}
                        </h1>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "p-2 rounded-lg transition-colors",
                            showFilters ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                    </button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <InboxFiltersPanel
                        groups={groups}
                        tags={tags}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                    />
                )}

                {/* Conversation List */}
                <ConversationList
                    conversations={conversations}
                    selectedPhone={selectedConversation?.contact_phone}
                    onSelect={handleSelectConversation}
                    isLoading={isLoading}
                />
            </div>

            {/* Main: Chat Window */}
            <div className={cn(
                "flex-1 flex flex-col",
                !selectedConversation ? "hidden md:flex" : "flex"
            )}>
                {selectedConversation ? (
                    <>
                        <ChatHeader
                            conversation={selectedConversation}
                            availableTags={tags}
                            onUpdateTags={handleUpdateTags}
                            onBack={() => setSelectedConversation(null)}
                        />
                        <ChatWindow
                            messages={messages}
                            isLoading={isLoadingMessages}
                            onSendMessage={handleSendMessage}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="64"
                                height="64"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mx-auto mb-4 opacity-50"
                            >
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <p className="text-lg">
                                {intl.formatMessage({
                                    id: 'inbox.selectConversation',
                                    defaultMessage: 'Select a conversation to start chatting'
                                })}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
