'use client';

import { useIntl } from 'react-intl';
import { InboxFilters, ContactGroup } from '@/lib/services/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InboxFiltersPanelProps {
    groups: ContactGroup[];
    tags: string[];
    filters: InboxFilters;
    onFilterChange: (filters: InboxFilters) => void;
}

export function InboxFiltersPanel({
    groups,
    tags,
    filters,
    onFilterChange
}: InboxFiltersPanelProps) {
    const intl = useIntl();

    // Toggle tag filter
    const toggleTagFilter = (tag: string) => {
        const currentTags = filters.tags || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];

        onFilterChange({
            ...filters,
            tags: newTags.length > 0 ? newTags : undefined
        });
    };

    // Toggle group filter
    const toggleGroupFilter = (groupId: string) => {
        const currentGroups = filters.group_ids || [];
        const newGroups = currentGroups.includes(groupId)
            ? currentGroups.filter(g => g !== groupId)
            : [...currentGroups, groupId];

        onFilterChange({
            ...filters,
            group_ids: newGroups.length > 0 ? newGroups : undefined
        });
    };

    // Toggle unread only filter
    const toggleUnreadOnly = () => {
        onFilterChange({
            ...filters,
            unread_only: !filters.unread_only
        });
    };

    // Clear all filters
    const clearFilters = () => {
        onFilterChange({});
    };

    // Check if any filters are active
    const hasActiveFilters =
        (filters.tags && filters.tags.length > 0) ||
        (filters.group_ids && filters.group_ids.length > 0) ||
        filters.unread_only;

    return (
        <div className="p-4 border-b border-border bg-muted/30 space-y-4">
            {/* Unread Only Toggle */}
            <div>
                <Button
                    variant={filters.unread_only ? "default" : "outline"}
                    size="sm"
                    onClick={toggleUnreadOnly}
                    className="w-full justify-start"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="4" fill="currentColor" />
                    </svg>
                    {intl.formatMessage({ id: 'inbox.unreadOnly', defaultMessage: 'Unread Only' })}
                </Button>
            </div>

            {/* Groups */}
            {groups.length > 0 && (
                <div>
                    <p className="text-sm font-medium mb-2">
                        {intl.formatMessage({ id: 'inbox.filterByGroup', defaultMessage: 'Filter by Group' })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {groups.map((group) => (
                            <Badge
                                key={group.id}
                                variant={filters.group_ids?.includes(group.id) ? "default" : "outline"}
                                className={cn(
                                    "cursor-pointer transition-colors",
                                    filters.group_ids?.includes(group.id) && "ring-2 ring-primary"
                                )}
                                style={group.color ? {
                                    borderColor: group.color,
                                    ...(filters.group_ids?.includes(group.id)
                                        ? { backgroundColor: group.color, color: 'white' }
                                        : { color: group.color })
                                } : undefined}
                                onClick={() => toggleGroupFilter(group.id)}
                            >
                                {group.name}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
                <div>
                    <p className="text-sm font-medium mb-2">
                        {intl.formatMessage({ id: 'inbox.filterByTag', defaultMessage: 'Filter by Tag' })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                            <Badge
                                key={tag}
                                variant={filters.tags?.includes(tag) ? "default" : "outline"}
                                className="cursor-pointer transition-colors"
                                onClick={() => toggleTagFilter(tag)}
                            >
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="w-full text-muted-foreground"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                    {intl.formatMessage({ id: 'inbox.clearFilters', defaultMessage: 'Clear Filters' })}
                </Button>
            )}
        </div>
    );
}
