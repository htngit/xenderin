import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Search, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ContactWithGroup } from '@/lib/services/types';
import { ContactService } from '@/lib/services';
import { syncManager } from '@/lib/sync/SyncManager';

interface NewChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectContact: (contact: ContactWithGroup) => void;
}

export function NewChatDialog({ open, onOpenChange, onSelectContact }: NewChatDialogProps) {
    const intl = useIntl();
    const [contacts, setContacts] = useState<ContactWithGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [contactService] = useState(() => new ContactService(syncManager));

    useEffect(() => {
        if (open) {
            loadContacts();
        }
    }, [open]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (open) {
                loadContacts(searchQuery);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, open]);

    const loadContacts = async (query: string = '') => {
        setIsLoading(true);
        try {
            let results: ContactWithGroup[] = [];
            if (query) {
                results = await contactService.searchContacts(query);
            } else {
                // Limit initial load to recent or first 20 for performance
                // ContactService.getContacts() might return all. 
                // We'll use search with empty string which might behave differently depending on implementation,
                // or just getContacts() and slice.
                // Looking at ContactService outline, searchContacts("") might not return all.
                // We'll use getContacts().
                results = await contactService.getContacts();
            }
            // Sort by name
            results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setContacts(results.slice(0, 50)); // Limit distinct display
        } catch (error) {
            console.error('Error loading contacts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 gap-0">
                <DialogHeader className="px-4 py-3 border-b">
                    <DialogTitle>
                        {intl.formatMessage({ id: 'inbox.newChat', defaultMessage: 'New Chat' })}
                    </DialogTitle>
                </DialogHeader>
                <Command shouldFilter={false} className="border-0">
                    <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={intl.formatMessage({ id: 'inbox.searchContacts', defaultMessage: 'Search contacts...' })}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <CommandList className="max-h-[300px] overflow-y-auto p-2">
                        {isLoading ? (
                            <div className="py-6 text-center text-sm text-muted-foreground flex justify-center items-center">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading...' })}
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                {intl.formatMessage({ id: 'inbox.noContactsFound', defaultMessage: 'No contacts found.' })}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {contacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => {
                                            onSelectContact(contact);
                                            onOpenChange(false);
                                        }}
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                {getInitials(contact.name || contact.phone)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col flex-1 overflow-hidden">
                                            <span className="font-medium truncate">{contact.name || intl.formatMessage({ id: 'common.unknown', defaultMessage: 'Unknown' })}</span>
                                            <span className="text-xs text-muted-foreground truncate">{contact.phone}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
