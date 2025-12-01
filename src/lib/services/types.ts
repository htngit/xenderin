// Type definitions untuk WhatsApp Automation App
// Ini akan digunakan di Phase 2 saat integrasi Supabase

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'staff';
  master_user_id: string;
  created_at: string;
  user_metadata?: any;
}

export interface Quota {
  id: string;
  user_id: string;
  master_user_id: string;
  plan_type: 'free' | 'basic' | 'pro';
  messages_limit: number;
  messages_used: number;
  remaining: number; // Calculated field: messages_limit - messages_used
  reset_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuotaReservation {
  id: string;
  user_id: string;
  master_user_id: string;
  quota_id?: string;
  amount: number;
  status: 'pending' | 'committed' | 'cancelled' | 'expired';
  expires_at?: string;
  committed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface QuotaStatus {
  user_id: string;
  master_user_id: string;
  messages_remaining: number;
  plan_type: string;
  reset_date: string;
  active_reservations: number;
  reserved_amount: number;
}

export interface ReservationResult {
  success: boolean;
  reservationId: string;
  messagesRemaining: number;
  errorMessage?: string;
}

export interface CommitResult {
  success: boolean;
  messagesUsed: number;
  messagesRemaining: number;
}

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  master_user_id: string;
  created_by: string;
  contact_count?: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  group_id: string;
  master_user_id: string;
  created_by: string;
  tags?: string[];
  notes?: string;
  is_blocked: boolean;
  last_interaction?: string;
  created_at: string;
  updated_at: string;
}

// Extended contact interface with group information for joins
export interface ContactWithGroup extends Contact {
  groups?: {
    id: string;
    name: string;
    color: string;
  };
}

// Contact with display group information
export interface ContactWithGroupDisplay extends Contact {
  group_name?: string;
  group_color?: string;
}

export interface Template {
  id: string;
  name: string;
  variants: string[];  // Array minimal 3 variant kalimat
  content?: string; // Backward compatibility - nullable
  master_user_id: string;
  created_by: string;
  attachment_url?: string;
  variables?: string[]; // Variables yang terdeteksi dari semua variants
  category: string;
  is_active?: boolean;
  usage_count?: number;
  created_at: string;
  updated_at: string;
  assets?: AssetFile[];
}

export interface AssetFile {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  uploaded_by: string;
  master_user_id: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  mime_type?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Additional properties that were referenced in the code
  size?: number;
  type?: string;
  uploadDate?: string;
  url?: string;
}

export interface TemplateVariant {
  id: string;
  content: string;
  variables: string[]; // Variables spesifik untuk variant ini
}

export interface ActivityLog {
  id: string;
  user_id: string;
  master_user_id: string;
  contact_group_id?: string;
  template_id?: string;
  template_name?: string;
  total_contacts: number;
  success_count: number;
  failed_count: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  delay_range: number;
  scheduled_for?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MessageLog {
  id: string;
  activity_log_id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at?: string;
  error_message?: string;
}

export interface SendConfig {
  contact_group_id: string;
  template_id: string;
  delay_range: number; // in seconds
  schedule_time?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  quota?: Quota;
  requiresEmailConfirmation?: boolean;
}

export interface PINValidation {
  is_valid: boolean;
  role: 'owner' | 'staff';
}

// Payment-related types
export type SubscriptionPlan = 'basic' | 'premium' | 'enterprise';

export interface DUITKUResponse {
  transactionId: string;
  qrUrl: string;
  paymentUrl: string;
  merchantOrderId: string;
  amount: number;
  success: boolean;
  message?: string;
}

export interface PaymentRequest {
  planType: SubscriptionPlan;
  amount: number;
  userId: string;
  email: string;
  phoneNumber?: string;
}

export interface PaymentSession {
  paymentId: string;
  duitkuTransactionId: string;
  qrUrl: string;
  amount: number;
  expiresAt: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  master_user_id: string;
  pin: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}