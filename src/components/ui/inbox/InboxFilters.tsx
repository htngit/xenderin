'use client';

import { useIntl } from 'react-intl';
import { InboxFilters, ContactGroup } from '@/lib/services/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

            {/* Groups & Tags Filters Row */}
            <div className="flex gap-2">
                {/* Groups Dropdown */}
                <div className="flex-1">
                    <Select
                        value={filters.group_ids?.[0] || "all"}
                        onValueChange={(value) => onFilterChange({
                            ...filters,
                            group_ids: value === "all" ? undefined : [value]
                        })}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={intl.formatMessage({ id: 'inbox.allGroups', defaultMessage: 'All Groups' })} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {intl.formatMessage({ id: 'inbox.allGroups', defaultMessage: 'All Groups' })}
                            </SelectItem>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: group.color || '#ccc' }}
                                        />
                                        {group.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Tags Dropdown */}
                <div className="flex-1">
                    <Select
                        value={filters.tags?.[0] || "all"}
                        onValueChange={(value) => onFilterChange({
                            ...filters,
                            tags: value === "all" ? undefined : [value]
                        })}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={intl.formatMessage({ id: 'inbox.allTags', defaultMessage: 'All Tags' })} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {intl.formatMessage({ id: 'inbox.allTags', defaultMessage: 'All Tags' })}
                            </SelectItem>
                            {tags.map((tag) => (
                                <SelectItem key={tag} value={tag}>
                                    {tag}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

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
