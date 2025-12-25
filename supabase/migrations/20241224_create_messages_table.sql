-- Migration: Create messages table for Inbox Chat feature
-- This table stores both inbound (received) and outbound (sent) messages

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  message_type TEXT DEFAULT 'text',
  has_media BOOLEAN DEFAULT false,
  media_url TEXT,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  whatsapp_message_id TEXT,
  activity_log_id UUID REFERENCES public.history(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.messages IS 'Stores WhatsApp messages for Inbox Chat feature';
COMMENT ON COLUMN public.messages.direction IS 'inbound = received from contact, outbound = sent to contact';
COMMENT ON COLUMN public.messages.status IS 'Message delivery status';
COMMENT ON COLUMN public.messages.whatsapp_message_id IS 'WhatsApp internal message ID for deduplication';
COMMENT ON COLUMN public.messages.activity_log_id IS 'Reference to blast campaign if message was sent via blast';

-- Create indexes for common queries
CREATE INDEX idx_messages_master_user_id ON public.messages(master_user_id);
CREATE INDEX idx_messages_contact_id ON public.messages(contact_id);
CREATE INDEX idx_messages_contact_phone ON public.messages(contact_phone);
CREATE INDEX idx_messages_direction ON public.messages(direction);
CREATE INDEX idx_messages_sent_at ON public.messages(sent_at DESC);
CREATE INDEX idx_messages_whatsapp_id ON public.messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

-- Composite index for conversation queries
CREATE INDEX idx_messages_conversation ON public.messages(master_user_id, contact_phone, sent_at DESC);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view messages belonging to their master account
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (
    master_user_id = auth.uid() 
    OR master_user_id IN (
      SELECT master_user_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can insert messages for their master account
CREATE POLICY "Users can insert own messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    master_user_id = auth.uid() 
    OR master_user_id IN (
      SELECT master_user_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can update messages for their master account
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (
    master_user_id = auth.uid() 
    OR master_user_id IN (
      SELECT master_user_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can delete messages for their master account
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (
    master_user_id = auth.uid() 
    OR master_user_id IN (
      SELECT master_user_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
