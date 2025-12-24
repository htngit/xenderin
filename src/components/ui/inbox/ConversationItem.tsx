'use client';

import { ConversationSummary } from '@/lib/services/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ConversationItemProps {
    conversation: ConversationSummary;
    isSelected: boolean;
    onClick: () => void;
}

export function ConversationItem({
    conversation,
    isSelected,
    onClick
}: ConversationItemProps) {
    const {
        contact_name,
        contact_phone,
        last_message,
        unread_count,
        contact_group_name,
        contact_group_color,
        contact_tags
    } = conversation;

    // Format timestamp
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    // Truncate message content
    const truncateMessage = (content: string | undefined, maxLength: number = 50) => {
        if (!content) return '';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    };

    // Get initials for avatar
    const getInitials = (name: string | undefined) => {
        if (!name) return '?';
        const parts = name.split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-start gap-3 p-4 cursor-pointer transition-colors",
                "hover:bg-muted/50",
                isSelected && "bg-primary/10 hover:bg-primary/15"
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-sm",
                    "bg-gradient-to-br from-primary to-primary/70"
                )}
                style={contact_group_color ? {
                    background: `linear-gradient(135deg, ${contact_group_color}, ${contact_group_color}aa)`
                } : undefined}
            >
                {getInitials(contact_name || contact_phone)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                        {contact_name || contact_phone}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                        {last_message?.sent_at && formatTime(last_message.sent_at)}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-1">
                    <p className={cn(
                        "text-sm truncate",
                        unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                        {last_message?.direction === 'outbound' && (
                            <span className="text-muted-foreground mr-1">You:</span>
                        )}
                        {truncateMessage(last_message?.content)}
                    </p>

                    {unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center px-1.5">
                            {unread_count > 99 ? '99+' : unread_count}
                        </span>
                    )}
                </div>

                {/* Tags and Group */}
                {(contact_group_name || (contact_tags && contact_tags.length > 0)) && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {contact_group_name && (
                            <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0"
                                style={contact_group_color ? { borderColor: contact_group_color, color: contact_group_color } : undefined}
                            >
                                {contact_group_name}
                            </Badge>
                        )}
                        {contact_tags?.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                {tag}
                            </Badge>
                        ))}
                        {contact_tags && contact_tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                                +{contact_tags.length - 2}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
