-- ============================================
-- CHAT MESSAGES DATABASE SCHEMA
-- ============================================
-- This creates a real-time chat system with multiple conversations per friend (Discord-like channels)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create conversations table
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_ids UUID[] NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT non_empty_title CHECK (title IS NULL OR LENGTH(TRIM(title)) > 0),
  CONSTRAINT at_least_two_participants CHECK (array_length(participant_ids, 1) >= 2)
);

-- 2. Create conversation_participants junction table for better querying
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- 3. Add conversation_id to messages table
-- ============================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- 4. Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_created_by_idx ON public.conversations(created_by);
CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx ON public.conversation_participants(conversation_id);

-- 5. Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies if they exist
-- ============================================
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages to conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.conversation_participants;

-- 7. Create RLS Policies for conversations
-- ============================================

-- Users can view conversations they participate in
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(participant_ids));

-- Users can create conversations (they must be in participant_ids)
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by AND auth.uid() = ANY(participant_ids));

-- Users can update conversations they participate in
CREATE POLICY "Users can update their conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(participant_ids))
  WITH CHECK (auth.uid() = ANY(participant_ids));

-- Users can delete conversations they created
CREATE POLICY "Users can delete their conversations"
  ON public.conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- 8. Create RLS Policies for conversation_participants
-- ============================================

-- Users can view participants of conversations they're in
CREATE POLICY "Users can view conversation participants"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_participants.conversation_id 
      AND auth.uid() = ANY(c.participant_ids)
    )
  );

-- Users can add participants to conversations they're in
CREATE POLICY "Users can add participants to their conversations"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_participants.conversation_id 
      AND auth.uid() = ANY(c.participant_ids)
    )
  );

-- Users can remove participants from conversations they created
CREATE POLICY "Users can remove participants"
  ON public.conversation_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_participants.conversation_id 
      AND auth.uid() = c.created_by
    )
  );

-- 9. Update RLS Policies for messages
-- ============================================

-- Users can view messages from conversations they participate in
CREATE POLICY "Users can view their messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    (
      conversation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
        AND auth.uid() = ANY(c.participant_ids)
      )
    )
  );

-- Users can send messages to conversations they participate in
CREATE POLICY "Users can insert messages to conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    (
      -- Legacy: direct messages between friends
      (conversation_id IS NULL AND
        EXISTS (
          SELECT 1 FROM public.friendships
          WHERE status = 'accepted'
          AND (
            (user_id = auth.uid() AND friend_id = receiver_id) OR
            (user_id = receiver_id AND friend_id = auth.uid())
          )
        )
      ) OR
      -- New: messages in conversations
      (conversation_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = conversation_id 
          AND auth.uid() = ANY(c.participant_ids)
          AND receiver_id = ANY(c.participant_ids)
        )
      )
    )
  );

-- Users can update (mark as read) messages in their conversations
CREATE POLICY "Users can update their received messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = receiver_id OR
    (
      conversation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
        AND auth.uid() = ANY(c.participant_ids)
      )
    )
  )
  WITH CHECK (
    auth.uid() = receiver_id OR
    (
      conversation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
        AND auth.uid() = ANY(c.participant_ids)
      )
    )
  );

-- Users can delete messages they sent
CREATE POLICY "Users can delete their own sent messages"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- 10. Create function to update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create trigger for conversation updated_at
-- ============================================
DROP TRIGGER IF EXISTS set_conversation_updated_at ON public.conversations;
CREATE TRIGGER set_conversation_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_conversation_updated_at();

-- Keep existing message updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_message_updated_at ON public.messages;
CREATE TRIGGER set_message_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_updated_at();

-- 12. Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- HELPER VIEWS AND FUNCTIONS
-- ============================================

-- Create a view for conversation list with latest message and participant info
CREATE OR REPLACE VIEW public.conversation_list AS
WITH latest_messages AS (
  SELECT DISTINCT ON (conversation_id)
    m.id,
    m.conversation_id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.read,
    m.created_at,
    ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY m.created_at DESC) as rn
  FROM public.messages m
  WHERE m.conversation_id IS NOT NULL
  ORDER BY conversation_id, m.created_at DESC
)
SELECT 
  c.id as conversation_id,
  c.title,
  c.created_by,
  c.participant_ids,
  c.created_at as conversation_created_at,
  lm.id as last_message_id,
  lm.content as last_message,
  lm.sender_id as last_message_sender_id,
  lm.created_at as last_message_time,
  lm.read as last_message_read,
  sender_profile.display_name as sender_name,
  sender_profile.email as sender_email,
  sender_profile.avatar_url as sender_avatar,
  array_length(c.participant_ids, 1) as participant_count
FROM public.conversations c
LEFT JOIN latest_messages lm ON c.id = lm.conversation_id AND lm.rn = 1
LEFT JOIN user_profiles sender_profile ON lm.sender_id = sender_profile.user_id
ORDER BY lm.created_at DESC NULLS LAST, c.created_at DESC;

-- Function to create a new conversation
CREATE OR REPLACE FUNCTION public.create_conversation(
  p_created_by UUID,
  p_participant_ids UUID[],
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Validate that creator is in participant list
  IF NOT p_created_by = ANY(p_participant_ids) THEN
    RAISE EXCEPTION 'Creator must be in participant list';
  END IF;
  
  -- Validate that all participants are friends with the creator (or same user)
  -- Skip this check for now to allow flexibility; can add friendship check later if needed
  
  INSERT INTO public.conversations (created_by, participant_ids, title)
  VALUES (p_created_by, p_participant_ids, p_title)
  RETURNING id INTO v_conversation_id;
  
  -- Add participants
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT v_conversation_id, unnest(p_participant_ids);
  
  RETURN v_conversation_id;
END;
$$;

-- Add an accepted friend to an existing conversation while keeping both
-- membership representations in sync.
CREATE OR REPLACE FUNCTION public.add_conversation_participant(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_ids UUID[];
BEGIN
  SELECT participant_ids
  INTO v_participant_ids
  FROM public.conversations
  WHERE id = p_conversation_id
    AND auth.uid() = ANY(participant_ids)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  IF p_user_id = ANY(v_participant_ids) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_id = p_user_id)
        OR (user_id = p_user_id AND friend_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Only accepted friends can be added to a conversation';
  END IF;

  UPDATE public.conversations
  SET participant_ids = array_append(participant_ids, p_user_id)
  WHERE id = p_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (p_conversation_id, p_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$;

-- Leaving a group removes only the caller. A two-person conversation is
-- deleted because the current schema has no per-user archive state.
CREATE OR REPLACE FUNCTION public.leave_conversation(
  p_conversation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_ids UUID[];
BEGIN
  SELECT participant_ids
  INTO v_participant_ids
  FROM public.conversations
  WHERE id = p_conversation_id
    AND auth.uid() = ANY(participant_ids)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  IF cardinality(v_participant_ids) <= 2 THEN
    DELETE FROM public.conversations WHERE id = p_conversation_id;
    RETURN;
  END IF;

  UPDATE public.conversations
  SET participant_ids = array_remove(participant_ids, auth.uid())
  WHERE id = p_conversation_id;

  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.add_conversation_participant(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_conversation_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_conversation(UUID) TO authenticated;

-- ============================================
-- HELPER QUERIES FOR TESTING
-- ============================================

-- View all conversations with participant info
SELECT 
  c.id,
  c.title,
  c.created_by,
  c.participant_ids,
  c.created_at,
  COUNT(cp.user_id) as participant_count
FROM conversations c
LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
GROUP BY c.id
ORDER BY c.created_at DESC;

-- View all messages with user details
SELECT 
  m.id,
  m.conversation_id,
  sender.email as sender_email,
  sender.display_name as sender_name,
  receiver.email as receiver_email,
  receiver.display_name as receiver_name,
  m.content,
  m.read,
  m.created_at
FROM messages m
JOIN user_profiles sender ON m.sender_id = sender.user_id
JOIN user_profiles receiver ON m.receiver_id = receiver.user_id
ORDER BY m.created_at DESC;

-- Get messages in a specific conversation
-- Replace 'CONVERSATION_ID' with actual conversation ID
-- SELECT 
--   m.*,
--   sender.display_name as sender_name
-- FROM messages m
-- JOIN user_profiles sender ON m.sender_id = sender.user_id
-- WHERE m.conversation_id = 'CONVERSATION_ID'
-- ORDER BY m.created_at ASC;
