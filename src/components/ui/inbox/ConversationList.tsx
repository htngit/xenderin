'use client';

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationSummary } from '@/lib/services/types';
import { ConversationItem } from './ConversationItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface ConversationListProps {
    conversations: ConversationSummary[];
    selectedPhone?: string;
    onSelect: (conversation: ConversationSummary) => void;
    onNewChat?: () => void;
    onDeleteChats?: (phones: string[]) => Promise<void>;
    isLoading: boolean;
}

export function ConversationList({
    conversations,
    selectedPhone,
    onSelect,
    onNewChat,
    onDeleteChats,
    isLoading
}: ConversationListProps) {
    const intl = useIntl();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSelectionMode, setIsSelectionMode] = React.useState(false);
    const [selectedPhones, setSelectedPhones] = React.useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Filter conversations by search query
    const filteredConversations = React.useMemo(() => {
        if (!searchQuery.trim()) return conversations;

        const query = searchQuery.toLowerCase();
        return conversations.filter(conv =>
            conv.contact_name?.toLowerCase().includes(query) ||
            conv.contact_phone.includes(query) ||
            conv.last_message?.content?.toLowerCase().includes(query)
        );
    }, [conversations, searchQuery]);

    // Handle entering selection mode
    const handleEnterSelectionMode = () => {
        setIsSelectionMode(true);
        setSelectedPhones(new Set());
    };

    // Handle exiting selection mode
    const handleExitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedPhones(new Set());
    };

    // Handle checkbox change
    const handleCheckChange = (phone: string, checked: boolean) => {
        setSelectedPhones(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(phone);
            } else {
                newSet.delete(phone);
            }
            return newSet;
        });
    };

    // Handle delete single chat
    const handleDeleteSingle = async (phone: string) => {
        if (onDeleteChats) {
            setIsDeleting(true);
            try {
                await onDeleteChats([phone]);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    // Handle delete selected chats
    const handleDeleteSelected = async () => {
        if (onDeleteChats && selectedPhones.size > 0) {
            setIsDeleting(true);
            try {
                await onDeleteChats(Array.from(selectedPhones));
                handleExitSelectionMode();
            } finally {
                setIsDeleting(false);
            }
        }
    };

    // Handle select all
    const handleSelectAll = () => {
        if (selectedPhones.size === filteredConversations.length) {
            // Deselect all
            setSelectedPhones(new Set());
        } else {
            // Select all
            setSelectedPhones(new Set(filteredConversations.map(c => c.contact_phone)));
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar & New Chat */}
            <div className="p-3 border-b border-border flex gap-2">
                <div className="relative flex-1">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <Input
                        type="text"
                        placeholder={intl.formatMessage({
                            id: 'inbox.searchPlaceholder',
                            defaultMessage: 'Search conversations...'
                        })}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {onNewChat && !isSelectionMode && (
                    <Button
                        size="icon"
                        variant="outline"
                        onClick={onNewChat}
                        className="h-10 w-10 shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Selection Mode Actions */}
            {isSelectionMode && (
                <div className="p-3 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleExitSelectionMode}
                            className="h-8 px-2"
                        >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            {selectedPhones.size} selected
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSelectAll}
                            className="h-8"
                        >
                            {selectedPhones.size === filteredConversations.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDeleteSelected}
                            disabled={selectedPhones.size === 0 || isDeleting}
                            className="h-8"
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {isDeleting ? 'Deleting...' : `Delete (${selectedPhones.size})`}
                        </Button>
                    </div>
                </div>
            )}

            {/* Conversations */}
            <ScrollArea className="flex-1">
                {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        {searchQuery ? (
                            intl.formatMessage({
                                id: 'inbox.noSearchResults',
                                defaultMessage: 'No conversations found'
                            })
                        ) : (
                            intl.formatMessage({
                                id: 'inbox.noConversations',
                                defaultMessage: 'No messages yet'
                            })
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredConversations.map((conversation) => (
                            <ConversationItem
                                key={conversation.contact_phone}
                                conversation={conversation}
                                isSelected={selectedPhone === conversation.contact_phone}
                                isSelectionMode={isSelectionMode}
                                isChecked={selectedPhones.has(conversation.contact_phone)}
                                onClick={() => onSelect(conversation)}
                                onCheckChange={(checked) => handleCheckChange(conversation.contact_phone, checked)}
                                onEnterSelectionMode={handleEnterSelectionMode}
                                onDelete={() => handleDeleteSingle(conversation.contact_phone)}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
