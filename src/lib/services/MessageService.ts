import { Message, ConversationSummary, InboxFilters } from './types';
import { supabase, handleDatabaseError } from '../supabase';
import { db, LocalMessage } from '../db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
    toISOString,
    localToSupabase,
    addSyncMetadata,
    addTimestamps,
    standardizeForService
} from '../utils/timestamp';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * MessageService handles all message-related operations for the Inbox Chat feature.
 * Follows the local-first pattern: writes to Dexie first, then syncs to Supabase.
 */
export class MessageService {
    private realtimeChannel: RealtimeChannel | null = null;
    private syncManager: SyncManager;
    private masterUserId: string | null = null;
    private localListeners: ((message: Message) => void)[] = [];

    constructor(syncManager?: SyncManager) {
        this.syncManager = syncManager || new SyncManager();
        this.setupSyncEventListeners();
    }

    /**
     * Subscribe to local message updates (for immediate UI refresh)
     */
    subscribeToLocalUpdates(callback: (message: Message) => void): () => void {
        this.localListeners.push(callback);
        return () => {
            this.localListeners = this.localListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify local listeners of changes
     */
    private notifyLocalListeners(message: Message) {
        for (const listener of this.localListeners) {
            try {
                listener(message);
            } catch (error) {
                console.error('Error in message listener:', error);
            }
        }
    }

    /**
     * Setup event listeners for sync events
     */
    private setupSyncEventListeners() {
        this.syncManager.addEventListener((event) => {
            if (event.table === 'messages') {
                switch (event.type) {
                    case 'sync_complete':
                        console.log('[MessageService] Messages sync completed');
                        break;
                    case 'sync_error':
                        console.error('[MessageService] Message sync error:', event.error);
                        break;
                }
            }
        });
    }

    /**
     * Set the current master user ID and configure sync
     */
    async initialize(masterUserId: string) {
        this.masterUserId = masterUserId;
        this.syncManager.setMasterUserId(masterUserId);
    }

    /**
     * Get the current authenticated user
     */
    private async getCurrentUser() {
        const user = await userContextManager.getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }
        return user;
    }

    /**
     * Get master user ID (for multi-tenant support)
     */
    private async getMasterUserId(): Promise<string> {
        if (this.masterUserId) {
            return this.masterUserId;
        }

        const user = await this.getCurrentUser();

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('master_user_id')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return user.id;
        }

        this.masterUserId = profile?.master_user_id || user.id;
        return this.masterUserId!;
    }

    /**
     * Transform local messages to match interface
     */
    private transformLocalMessages(localMessages: LocalMessage[]): Message[] {
        return localMessages.map(msg => {
            const standardized = standardizeForService(msg, 'message');
            return {
                id: standardized.id,
                master_user_id: standardized.master_user_id,
                contact_id: standardized.contact_id,
                contact_phone: standardized.contact_phone,
                contact_name: standardized.contact_name,
                direction: standardized.direction,
                content: standardized.content,
                message_type: standardized.message_type || 'text',
                has_media: standardized.has_media || false,
                media_url: standardized.media_url,
                status: standardized.status,
                whatsapp_message_id: standardized.whatsapp_message_id,
                activity_log_id: standardized.activity_log_id,
                sent_at: standardized.sent_at,
                created_at: standardized.created_at,
                updated_at: standardized.updated_at
            } as Message;
        });
    }

    /**
     * Get all messages for the current user
     */
    async getMessages(): Promise<Message[]> {
        try {
            const masterUserId = await this.getMasterUserId();

            const localMessages = await db.messages
                .where('master_user_id')
                .equals(masterUserId)
                .and(msg => !msg._deleted)
                .reverse()
                .sortBy('sent_at');

            if (localMessages.length > 0) {
                return this.transformLocalMessages(localMessages);
            }

            // Fallback to server if no local data
            const isOnline = this.syncManager.getIsOnline();
            if (!isOnline) return [];

            return await this.fetchMessagesFromServer();
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    /**
     * Get messages for a specific contact by phone number
     */
    async getMessagesByPhone(phone: string): Promise<Message[]> {
        try {
            const masterUserId = await this.getMasterUserId();

            // Normalize phone number (remove any formatting)
            const normalizedPhone = phone.replace(/[^\d]/g, '');

            const localMessages = await db.messages
                .where('master_user_id')
                .equals(masterUserId)
                .and(msg => !msg._deleted && msg.contact_phone.replace(/[^\d]/g, '') === normalizedPhone)
                .toArray();

            // Sort by sent_at ascending (oldest first for chat view)
            localMessages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

            return this.transformLocalMessages(localMessages);
        } catch (error) {
            console.error('Error fetching messages by phone:', error);
            return [];
        }
    }

    /**
     * Get messages for a specific contact by ID
     */
    async getMessagesByContactId(contactId: string): Promise<Message[]> {
        try {
            const masterUserId = await this.getMasterUserId();

            const localMessages = await db.messages
                .where('master_user_id')
                .equals(masterUserId)
                .and(msg => !msg._deleted && msg.contact_id === contactId)
                .toArray();

            // Sort by sent_at ascending
            localMessages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

            return this.transformLocalMessages(localMessages);
        } catch (error) {
            console.error('Error fetching messages by contact ID:', error);
            return [];
        }
    }

    /**
     * Fetch messages from server (fallback)
     */
    private async fetchMessagesFromServer(): Promise<Message[]> {
        const masterUserId = await this.getMasterUserId();

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('master_user_id', masterUserId)
            .order('sent_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        return (data || []).map(msg => {
            const standardized = standardizeForService(msg, 'message');
            return standardized as Message;
        });
    }

    /**
     * Create a new message (local-first)
     */
    async createMessage(
        messageData: Omit<Message, 'id' | 'created_at' | 'updated_at' | 'master_user_id'>
    ): Promise<Message> {
        try {
            const masterUserId = await this.getMasterUserId();

            const timestamps = addTimestamps({}, false);
            const syncMetadata = addSyncMetadata({}, false);

            const messageId = crypto.randomUUID();
            const localMessage: LocalMessage = {
                id: messageId,
                master_user_id: masterUserId,
                contact_id: messageData.contact_id,
                contact_phone: messageData.contact_phone,
                contact_name: messageData.contact_name,
                direction: messageData.direction,
                content: messageData.content,
                message_type: messageData.message_type || 'text',
                has_media: messageData.has_media || false,
                media_url: messageData.media_url,
                status: messageData.status,
                whatsapp_message_id: messageData.whatsapp_message_id,
                activity_log_id: messageData.activity_log_id,
                sent_at: messageData.sent_at || toISOString(new Date()),
                created_at: timestamps.created_at,
                updated_at: timestamps.updated_at,
                _syncStatus: syncMetadata._syncStatus,
                _lastModified: syncMetadata._lastModified,
                _version: syncMetadata._version,
                _deleted: false
            };

            // Add to local database
            await db.messages.add(localMessage);

            // Queue for sync
            const syncData = localToSupabase(localMessage);
            await this.syncManager.addToSyncQueue('messages', 'create', messageId, syncData);

            const transformedMessage = this.transformLocalMessages([localMessage])[0];
            this.notifyLocalListeners(transformedMessage);

            return transformedMessage;
        } catch (error) {
            console.error('Error creating message:', error);
            throw new Error(handleDatabaseError(error));
        }
    }

    /**
     * Create message from incoming WhatsApp message (via IPC)
     */
    async createFromIncomingWhatsApp(data: {
        id: string;
        from: string;
        to: string;
        body: string;
        type: string;
        timestamp: number;
        hasMedia: boolean;
    }): Promise<Message> {
        // Check for duplicate by whatsapp_message_id
        const existing = await db.messages
            .where('whatsapp_message_id')
            .equals(data.id)
            .first();

        if (existing) {
            console.log('[MessageService] Message already exists:', data.id);
            return this.transformLocalMessages([existing])[0];
        }

        // Try to find contact by phone
        const masterUserId = await this.getMasterUserId();
        const normalizedPhone = data.from.replace('@c.us', '').replace(/[^\d]/g, '');

        let contactId: string | undefined;
        let contactName: string | undefined;

        const contact = await db.contacts
            .where('master_user_id')
            .equals(masterUserId)
            .and(c => !c._deleted && c.phone.replace(/[^\d]/g, '') === normalizedPhone)
            .first();

        if (contact) {
            contactId = contact.id;
            contactName = contact.name;
        }

        return this.createMessage({
            contact_id: contactId,
            contact_phone: normalizedPhone,
            contact_name: contactName,
            direction: 'inbound',
            content: data.body,
            message_type: data.type,
            has_media: data.hasMedia,
            status: 'received',
            whatsapp_message_id: data.id,
            sent_at: toISOString(new Date(data.timestamp * 1000))
        });
    }

    /**
     * Create outbound message record (for blast/send integration)
     */
    async createOutboundMessage(data: {
        contact_id?: string;
        contact_phone: string;
        contact_name?: string;
        content: string;
        activity_log_id?: string;
        has_media?: boolean;
        media_url?: string;
    }): Promise<Message> {
        return this.createMessage({
            contact_id: data.contact_id,
            contact_phone: data.contact_phone,
            contact_name: data.contact_name,
            direction: 'outbound',
            content: data.content,
            message_type: 'text',
            has_media: data.has_media || false,
            media_url: data.media_url,
            status: 'sent',
            activity_log_id: data.activity_log_id,
            sent_at: toISOString(new Date())
        });
    }

    /**
     * Get conversation list with summaries
     */
    async getConversations(filters?: InboxFilters): Promise<ConversationSummary[]> {
        try {
            const masterUserId = await this.getMasterUserId();

            // Get all messages grouped by contact_phone
            const allMessages = await db.messages
                .where('master_user_id')
                .equals(masterUserId)
                .and(msg => !msg._deleted)
                .toArray();

            // Group messages by contact_phone
            const conversationMap = new Map<string, LocalMessage[]>();
            for (const msg of allMessages) {
                const phone = msg.contact_phone;
                if (!conversationMap.has(phone)) {
                    conversationMap.set(phone, []);
                }
                conversationMap.get(phone)!.push(msg);
            }

            // Build conversation summaries
            const summaries: ConversationSummary[] = [];

            for (const [phone, messages] of conversationMap) {
                // Sort messages by sent_at to get the last one
                messages.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
                const lastMessage = messages[0];

                // Count unread (inbound messages that haven't been marked as read)
                const unreadCount = messages.filter(m => m.direction === 'inbound' && m.status === 'received').length;

                // Get contact info
                let contactName: string | undefined = lastMessage.contact_name;
                let contactId: string | undefined = lastMessage.contact_id;
                let contactTags: string[] | undefined;
                let contactGroupId: string | undefined;
                let contactGroupName: string | undefined;
                let contactGroupColor: string | undefined;

                if (lastMessage.contact_id) {
                    const contact = await db.contacts.get(lastMessage.contact_id);
                    if (contact && !contact._deleted) {
                        contactName = contact.name;
                        contactId = contact.id;
                        contactTags = contact.tags;
                        contactGroupId = contact.group_id;

                        // Get group info
                        if (contact.group_id) {
                            const group = await db.groups.get(contact.group_id);
                            if (group && !group._deleted) {
                                contactGroupName = group.name;
                                contactGroupColor = group.color;
                            }
                        }
                    }
                }

                summaries.push({
                    contact_phone: phone,
                    contact_name: contactName,
                    contact_id: contactId,
                    contact_tags: contactTags,
                    contact_group_id: contactGroupId,
                    contact_group_name: contactGroupName,
                    contact_group_color: contactGroupColor,
                    last_message: this.transformLocalMessages([lastMessage])[0],
                    unread_count: unreadCount,
                    last_activity: lastMessage.sent_at
                });
            }

            // Apply filters
            let filtered = summaries;

            if (filters?.tags && filters.tags.length > 0) {
                filtered = filtered.filter(s =>
                    s.contact_tags?.some(tag => filters.tags!.includes(tag))
                );
            }

            if (filters?.group_ids && filters.group_ids.length > 0) {
                filtered = filtered.filter(s =>
                    s.contact_group_id && filters.group_ids!.includes(s.contact_group_id)
                );
            }

            if (filters?.search) {
                const searchLower = filters.search.toLowerCase();
                filtered = filtered.filter(s =>
                    s.contact_name?.toLowerCase().includes(searchLower) ||
                    s.contact_phone.includes(filters.search!) ||
                    s.last_message?.content?.toLowerCase().includes(searchLower)
                );
            }

            if (filters?.unread_only) {
                filtered = filtered.filter(s => s.unread_count > 0);
            }

            // Sort by last activity (most recent first)
            filtered.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());

            return filtered;
        } catch (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
    }

    /**
     * Mark messages as read
     */
    async markAsRead(messageIds: string[]): Promise<void> {
        try {
            const syncMetadata = addSyncMetadata({}, true);

            for (const id of messageIds) {
                await db.messages.update(id, {
                    status: 'read',
                    updated_at: toISOString(new Date()),
                    _syncStatus: syncMetadata._syncStatus,
                    _lastModified: syncMetadata._lastModified,
                    _version: syncMetadata._version
                });

                const updated = await db.messages.get(id);
                if (updated) {
                    const syncData = localToSupabase(updated);
                    await this.syncManager.addToSyncQueue('messages', 'update', id, syncData);
                }
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    /**
     * Get available tags from contacts
     */
    async getAvailableTags(): Promise<string[]> {
        try {
            const masterUserId = await this.getMasterUserId();
            const contacts = await db.contacts
                .where('master_user_id')
                .equals(masterUserId)
                .and(c => !c._deleted)
                .toArray();

            const tagSet = new Set<string>();
            for (const contact of contacts) {
                if (contact.tags) {
                    for (const tag of contact.tags) {
                        tagSet.add(tag);
                    }
                }
            }

            return Array.from(tagSet).sort();
        } catch (error) {
            console.error('Error fetching tags:', error);
            return [];
        }
    }

    /**
     * Get total unread count
     */
    async getUnreadCount(): Promise<number> {
        try {
            const masterUserId = await this.getMasterUserId();
            const unread = await db.messages
                .where('master_user_id')
                .equals(masterUserId)
                .and(msg => !msg._deleted && msg.direction === 'inbound' && msg.status === 'received')
                .count();

            return unread;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Force sync with server
     */
    async forceSync(): Promise<void> {
        await this.syncManager.triggerSync();
    }

    /**
     * Clean up when service is destroyed
     */
    destroy() {
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
        this.localListeners = [];
    }
}
