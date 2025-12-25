'use client';

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { ConversationSummary } from '@/lib/services/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
    conversation: ConversationSummary;
    availableTags: string[];
    onUpdateTags: (contactId: string, tags: string[]) => void;
    onBack: () => void;
}

export function ChatHeader({
    conversation,
    availableTags,
    onUpdateTags,
    onBack
}: ChatHeaderProps) {
    const intl = useIntl();
    const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>(conversation.contact_tags || []);
    const [newTag, setNewTag] = useState('');

    // Get initials for avatar
    const getInitials = (name: string | undefined) => {
        if (!name) return '?';
        const parts = name.split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // Handle tag toggle
    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    // Handle add new tag
    const handleAddNewTag = () => {
        if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
            setSelectedTags(prev => [...prev, newTag.trim()]);
            setNewTag('');
        }
    };

    // Handle save tags
    const handleSaveTags = () => {
        if (conversation.contact_id) {
            onUpdateTags(conversation.contact_id, selectedTags);
        }
        setIsTagPopoverOpen(false);
    };

    // Format phone number
    const formatPhone = (phone: string) => {
        if (phone.length > 10) {
            return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 9)} ${phone.slice(9)}`;
        }
        return phone;
    };

    return (
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
            {/* Back Button (Mobile) */}
            <button
                onClick={onBack}
                className="md:hidden p-2 -ml-2 hover:bg-muted rounded-lg"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                </svg>
            </button>

            {/* Avatar */}
            <div
                className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm",
                    "bg-gradient-to-br from-primary to-primary/70"
                )}
                style={conversation.contact_group_color ? {
                    background: `linear-gradient(135deg, ${conversation.contact_group_color}, ${conversation.contact_group_color}aa)`
                } : undefined}
            >
                {getInitials(conversation.contact_name || conversation.contact_phone)}
            </div>

            {/* Contact Info */}
            <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">
                    {conversation.contact_name || formatPhone(conversation.contact_phone)}
                </h2>
                {conversation.contact_name && (
                    <p className="text-sm text-muted-foreground">
                        {formatPhone(conversation.contact_phone)}
                    </p>
                )}
            </div>

            {/* Tags Display */}
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap max-w-[200px]">
                {conversation.contact_tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                    </Badge>
                ))}
                {conversation.contact_tags && conversation.contact_tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                        +{conversation.contact_tags.length - 3}
                    </span>
                )}
            </div>

            {/* Update Tags Button */}
            {conversation.contact_id && (
                <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                <path d="M7 7h.01" />
                            </svg>
                            {intl.formatMessage({ id: 'inbox.updateTags', defaultMessage: 'Tags' })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-medium mb-2">
                                    {intl.formatMessage({ id: 'inbox.manageTags', defaultMessage: 'Manage Tags' })}
                                </h4>
                            </div>

                            {/* Available Tags */}
                            <div className="flex flex-wrap gap-2">
                                {availableTags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => handleTagToggle(tag)}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            {/* Add New Tag */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder={intl.formatMessage({ id: 'inbox.newTag', defaultMessage: 'New tag...' })}
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewTag()}
                                />
                                <Button variant="outline" size="icon" onClick={handleAddNewTag}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14" />
                                        <path d="M12 5v14" />
                                    </svg>
                                </Button>
                            </div>

                            {/* Selected Tags Preview */}
                            {selectedTags.length > 0 && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {intl.formatMessage({ id: 'inbox.selectedTags', defaultMessage: 'Selected:' })}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedTags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="pr-1">
                                                {tag}
                                                <button
                                                    onClick={() => handleTagToggle(tag)}
                                                    className="ml-1 hover:text-destructive"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M18 6 6 18" />
                                                        <path d="m6 6 12 12" />
                                                    </svg>
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <Button onClick={handleSaveTags} className="w-full">
                                {intl.formatMessage({ id: 'inbox.saveTags', defaultMessage: 'Save Tags' })}
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
