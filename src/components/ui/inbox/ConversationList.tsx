'use client';

import * as React from 'react';
import { useIntl } from 'react-intl';
import { ConversationSummary } from '@/lib/services/types';
import { ConversationItem } from './ConversationItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface ConversationListProps {
    conversations: ConversationSummary[];
    selectedPhone?: string;
    onSelect: (conversation: ConversationSummary) => void;
    isLoading: boolean;
}

export function ConversationList({
    conversations,
    selectedPhone,
    onSelect,
    isLoading
}: ConversationListProps) {
    const intl = useIntl();
    const [searchQuery, setSearchQuery] = React.useState('');

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

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-3 border-b border-border">
                <div className="relative">
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
            </div>

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
                                onClick={() => onSelect(conversation)}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
