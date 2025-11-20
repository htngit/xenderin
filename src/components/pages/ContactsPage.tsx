import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/lib/services/ServiceContext';
import { handleServiceError } from '@/lib/utils/errorHandling';
import { Contact, ContactGroup } from '@/lib/services/types';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AnimatedButton } from '@/components/ui/animated-button';
import { AnimatedCard } from '@/components/ui/animated-card';
import { FadeIn, Stagger } from '@/components/ui/animations';
import { ContactModal } from '@/components/ui/ContactModal';
import { UploadContactsDialog } from '@/components/ui/UploadContactsDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Search,
  Upload,
  UserPlus,
  Filter,
  Users,
  Settings,
  Phone,
  Tag,
  ArrowLeft,
  Hash,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react';

// Placeholder content component for when data is loaded
function ContactsPageContent({
  contacts,
  filteredContacts,
  groups,
  searchQuery,
  setSearchQuery,
  selectedContactIds,
  handleSelectContact,
  handleSelectAll,
  handleAddContact,
  handleEditContact,
  handleDeleteContact,
  handleBulkDelete,
  showBulkDeleteDialog,
  confirmBulkDelete,
  cancelBulkDelete,
  isBulkDeleting,
  getGroupById,
  stats,
  isLoading,
  onUploadClick
}: {
  contacts: Contact[];
  filteredContacts: Contact[];
  groups: ContactGroup[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedContactIds: Set<string>;
  handleSelectContact: (contactId: string, checked: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  handleAddContact: () => void;
  handleEditContact: (contactId: string) => void;
  handleDeleteContact: (contactId: string) => void;
  handleBulkDelete: () => void;
  showBulkDeleteDialog: boolean;
  confirmBulkDelete: () => void;
  cancelBulkDelete: () => void;
  isBulkDeleting: boolean;
  getGroupById: (groupId: string) => ContactGroup | undefined;
  stats: any;
  isLoading: boolean;
  onUploadClick: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <FadeIn>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
                <p className="text-gray-600">Manage your WhatsApp contacts organized by groups</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <AnimatedButton
                animation="scale"
                variant="outline"
                onClick={() => navigate('/groups')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Groups
              </AnimatedButton>
              <AnimatedButton animation="scale" onClick={onUploadClick}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Contacts
              </AnimatedButton>
              <AnimatedButton animation="scale" onClick={handleAddContact}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Contact
              </AnimatedButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <AnimatedCard animation="slideUp" delay={0.1}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats.total}</div>
                )}
                <p className="text-xs text-muted-foreground">All contacts</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.2}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Groups</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats.groups.length}</div>
                )}
                <p className="text-xs text-muted-foreground">Contact groups</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.3}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Group Size</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats.averageGroupSize}</div>
                )}
                <p className="text-xs text-muted-foreground">Contacts per group</p>
              </CardContent>
            </AnimatedCard>
          </div>

          {/* Search Only - NO GROUP FILTER BUTTONS AS REQUESTED */}
          <AnimatedCard animation="fadeIn" delay={0.4}>
            <CardHeader>
              <CardTitle>Search Contacts</CardTitle>
              <CardDescription>
                Search contacts by name, phone, or tags. Group filtering handled via database logic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts by name, phone, or tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          {/* Contacts Table */}
          <AnimatedCard animation="fadeIn" delay={0.5} className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contacts List ({filteredContacts.length})</CardTitle>
                  <CardDescription>
                    {searchQuery
                      ? `All contacts matching "${searchQuery}"`
                      : 'All contacts across all groups'
                    }
                  </CardDescription>
                </div>
                {selectedContactIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedContactIds.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredContacts.length === 0 && !isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? 'No contacts found matching your search.'
                    : 'No contacts found. Add some contacts to get started.'
                  }
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all contacts"
                          disabled={isLoading}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      // Skeleton Rows
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {searchQuery
                            ? 'No contacts found matching your search.'
                            : 'No contacts found. Add some contacts to get started.'
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContacts.map((contact) => {
                        const group = getGroupById(contact.group_id);
                        const isSelected = selectedContactIds.has(contact.id);
                        return (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                                aria-label={`Select ${contact.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{contact.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{contact.phone}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {group ? (
                                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                  <div
                                    className="w-3 h-3 rounded-full border"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  {group.name}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Unknown Group</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {contact.tags && contact.tags.length > 0 ? (
                                  contact.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      <Tag className="h-3 w-3 mr-1" />
                                      {tag}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-sm">No tags</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {new Date(contact.created_at).toLocaleDateString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditContact(contact.id)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteContact(contact.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </AnimatedCard>
        </FadeIn>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={cancelBulkDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedContactIds.size} contact{selectedContactIds.size > 1 ? 's' : ''}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelBulkDelete} disabled={isBulkDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function ContactsPage() {
  const { contactService, groupService, isInitialized } = useServices();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Multi-select state
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal handler functions
  const handleAddContact = () => {
    setModalMode('add');
    setSelectedContact(null);
    setIsModalOpen(true);
  };

  const handleEditContact = async (contactId: string) => {
    try {
      const contact = await contactService.getContactById(contactId);
      if (contact) {
        setModalMode('edit');
        setSelectedContact(contact);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching contact for edit:', error);
      setNotification({ message: 'Error loading contact for editing', type: 'error' });
    }
  };

  const handleModalSave = async (savedContact: Contact | null) => {
    if (!savedContact) return;
    // Refresh the contacts list
    await loadData();
    setNotification(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };

  const handleDeleteContact = async (contactId: string) => {
    setDeleteContactId(contactId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteContact = async () => {
    if (!deleteContactId) return;

    try {
      const contact = await contactService.getContactById(deleteContactId);
      if (contact) {
        const success = await contactService.deleteContact(deleteContactId);
        if (success) {
          // Refresh the contacts list
          await loadData();
          setNotification({ message: `${contact.name} has been deleted successfully.`, type: 'success' });
        } else {
          setNotification({ message: 'Failed to delete contact. Please try again.', type: 'error' });
        }
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      setNotification({ message: 'An error occurred while deleting the contact.', type: 'error' });
    } finally {
      setShowDeleteDialog(false);
      setDeleteContactId(null);
    }
  };

  const cancelDeleteContact = () => {
    setShowDeleteDialog(false);
    setDeleteContactId(null);
  };

  // Multi-select handlers
  const handleSelectContact = (contactId: string, checked: boolean) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(contactId);
      } else {
        newSet.delete(contactId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    } else {
      setSelectedContactIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedContactIds.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedContactIds.size === 0) return;

    try {
      setIsBulkDeleting(true);
      const idsToDelete = Array.from(selectedContactIds);
      const result = await contactService.deleteMultipleContacts(idsToDelete);

      if (result.success) {
        await loadData();
        setSelectedContactIds(new Set());
        toast({
          title: "Success",
          description: `${result.deletedCount} contact${result.deletedCount > 1 ? 's' : ''} deleted successfully.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete contacts. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast({
        title: "Error",
        description: "An error occurred while deleting contacts.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteDialog(false);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [contactsData, groupsData] = await Promise.all([
        contactService.getContacts(),
        groupService.getGroups()
      ]);
      setContacts(contactsData);
      setGroups(groupsData);
    } catch (err) {
      console.error('Failed to load contacts data:', err);
      const appError = handleServiceError(err, 'loadContacts');
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized, contactService, groupService]);

  // Filter contacts effect - synchronous filtering logic
  useEffect(() => {
    let filtered = [...contacts];

    // Filter by search query only
    if (searchQuery) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery) ||
        (contact.tags && contact.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      );
    }

    setFilteredContacts(filtered);
  }, [contacts, searchQuery]);

  const getGroupById = (groupId: string) => {
    return groups.find(g => g.id === groupId);
  };

  const getGroupStats = () => {
    const totalContacts = contacts.length;
    const groupsWithCounts = groups.map(group => ({
      ...group,
      contact_count: contacts.filter(c => c.group_id === group.id).length
    }));

    return {
      total: totalContacts,
      groups: groupsWithCounts,
      largestGroup: groupsWithCounts.reduce((largest, group) =>
        (group.contact_count || 0) > (largest.contact_count || 0) ? group : largest,
        groupsWithCounts[0]
      ),
      averageGroupSize: groupsWithCounts.length > 0
        ? Math.round(groupsWithCounts.reduce((sum, group) => sum + (group.contact_count || 0), 0) / groupsWithCounts.length)
        : 0
    };
  };

  const stats = getGroupStats();

  // if (isLoading) {
  //   return <LoadingScreen message="Loading contacts..." />;
  // }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  return (
    <>
      <ContactsPageContent
        contacts={contacts}
        filteredContacts={filteredContacts}
        groups={groups}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedContactIds={selectedContactIds}
        handleSelectContact={handleSelectContact}
        handleSelectAll={handleSelectAll}
        handleAddContact={handleAddContact}
        handleEditContact={handleEditContact}
        handleDeleteContact={handleDeleteContact}
        handleBulkDelete={handleBulkDelete}
        showBulkDeleteDialog={showBulkDeleteDialog}
        confirmBulkDelete={confirmBulkDelete}
        cancelBulkDelete={cancelBulkDelete}
        isBulkDeleting={isBulkDeleting}
        getGroupById={getGroupById}
        stats={stats}
        isLoading={isLoading}
        onUploadClick={() => setShowUploadDialog(true)}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        mode={modalMode}
        contact={selectedContact || undefined}
        groups={groups}
        contactService={contactService}
        onNotification={setNotification}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteContact}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteContact} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Contacts Dialog */}
      <UploadContactsDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onSuccess={() => {
          loadData();
          setNotification({ message: 'Contacts uploaded successfully', type: 'success' });
        }}
      />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`rounded-lg p-4 shadow-lg ${notification.type === 'success'
            ? 'bg-green-100 border border-green-200 text-green-800'
            : 'bg-red-100 border border-red-200 text-red-800'
            }`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{notification.message}</p>
              <button
                onClick={() => setNotification(null)}
                className="ml-4 text-sm opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}