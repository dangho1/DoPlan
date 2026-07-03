-- Chat membership operations for DOP-71.
-- Run this file against existing environments after chat_schema.sql.

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

-- Add multiple accepted friends to an existing conversation in one call.
CREATE OR REPLACE FUNCTION public.add_conversation_participants(
  p_conversation_id UUID,
  p_user_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    PERFORM public.add_conversation_participant(p_conversation_id, v_user_id);
  END LOOP;
END;
$$;

-- Remove a participant from a group conversation while keeping both
-- membership representations in sync. Two-person chats should be deleted by
-- leave_conversation instead so the caller explicitly confirms that action.
CREATE OR REPLACE FUNCTION public.remove_conversation_participant(
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

  IF cardinality(v_participant_ids) <= 2 THEN
    RAISE EXCEPTION 'Use leave_conversation to delete a two-person conversation';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use leave_conversation to remove yourself';
  END IF;

  IF NOT p_user_id = ANY(v_participant_ids) THEN
    RETURN;
  END IF;

  UPDATE public.conversations
  SET participant_ids = array_remove(participant_ids, p_user_id)
  WHERE id = p_conversation_id;

  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_conversation_participants(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_conversation_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_conversation_participants(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_conversation_participant(UUID, UUID) TO authenticated;
