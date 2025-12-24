'use client';

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Message } from '@/lib/services/types';
import { ChatBubble } from '@/components/ui/inbox/ChatBubble';
import { ChatInput } from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    onSendMessage: (content: string) => Promise<void>;
}

export function ChatWindow({ messages, isLoading, onSendMessage }: ChatWindowProps) {
    const intl = useIntl();
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Group messages by date
    const messagesByDate = React.useMemo(() => {
        const groups: { date: string; messages: Message[] }[] = [];
        let currentDate = '';

        for (const message of messages) {
            const msgDate = new Date(message.sent_at).toLocaleDateString();

            if (msgDate !== currentDate) {
                currentDate = msgDate;
                groups.push({ date: msgDate, messages: [message] });
            } else {
                groups[groups.length - 1].messages.push(message);
            }
        }

        return groups;
    }, [messages]);

    // Format date header
    const formatDateHeader = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return intl.formatMessage({ id: 'inbox.today', defaultMessage: 'Today' });
        } else if (diffDays === 1) {
            return intl.formatMessage({ id: 'inbox.yesterday', defaultMessage: 'Yesterday' });
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'long' });
        } else {
            return date.toLocaleDateString([], {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            );
        }

        if (messages.length === 0) {
            return (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mx-auto mb-3 opacity-50"
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <p>
                            {intl.formatMessage({
                                id: 'inbox.noMessages',
                                defaultMessage: 'No messages in this conversation'
                            })}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <ScrollArea className="h-full" ref={scrollRef}>
                <div className="p-4 space-y-4">
                    {messagesByDate.map((group) => (
                        <div key={group.date}>
                            {/* Date Header */}
                            <div className="flex justify-center mb-4">
                                <span className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                                    {formatDateHeader(group.date)}
                                </span>
                            </div>

                            {/* Messages */}
                            <div className="space-y-2">
                                {group.messages.map((message) => (
                                    <ChatBubble key={message.id} message={message} />
                                ))}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
        );
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-muted/30">
            <div className="flex-1 min-h-0">
                {renderContent()}
            </div>
            <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
        </div>
    );
}
