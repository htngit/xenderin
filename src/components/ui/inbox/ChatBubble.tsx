'use client';

import { Message } from '@/lib/services/types';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
    message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
    const isOutbound = message.direction === 'outbound';

    // Format timestamp
    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get status icon for outbound messages
    const StatusIcon = () => {
        switch (message.status) {
            case 'sent':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                );
            case 'delivered':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 6 9 17 4 12" />
                        <polyline points="22 6 13 17" />
                    </svg>
                );
            case 'read':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 6 9 17 4 12" />
                        <polyline points="22 6 13 17" />
                    </svg>
                );
            case 'failed':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div className={cn(
            "flex",
            isOutbound ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
                isOutbound
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card text-card-foreground rounded-bl-md border border-border"
            )}>
                {/* Message Content */}
                {message.has_media && message.media_url && (
                    <div className="mb-2">
                        <img
                            src={message.media_url}
                            alt="Media"
                            className="max-w-full rounded-lg"
                            style={{ maxHeight: '300px' }}
                        />
                    </div>
                )}

                {message.content && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                        {message.content}
                    </p>
                )}

                {/* Timestamp and Status */}
                <div className={cn(
                    "flex items-center gap-1 mt-1",
                    isOutbound ? "justify-end" : "justify-start"
                )}>
                    <span className={cn(
                        "text-[10px]",
                        isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                        {formatTime(message.sent_at)}
                    </span>

                    {isOutbound && (
                        <span className="text-primary-foreground/70">
                            <StatusIcon />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
