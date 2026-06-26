-- ShareFIT — Supabase Setup SQL
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times (all statements are idempotent).

-- ── 1. Items table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.items (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name      TEXT          NOT NULL,
  brand          TEXT,
  size           TEXT          NOT NULL,
  category       TEXT          NOT NULL,
  style          TEXT          NOT NULL,
  price_per_day  NUMERIC(10,2) NOT NULL CHECK (price_per_day > 0),
  image_url      TEXT,
  is_available   BOOLEAN       DEFAULT TRUE,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 2. Row-Level Security for items ──────────────────────────────────────────
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_all"  ON public.items;
DROP POLICY IF EXISTS "items_insert_own"  ON public.items;
DROP POLICY IF EXISTS "items_update_own"  ON public.items;
DROP POLICY IF EXISTS "items_delete_own"  ON public.items;

-- Anyone can browse listings
CREATE POLICY "items_select_all" ON public.items
  FOR SELECT USING (true);

-- Only the owner can insert their own items
CREATE POLICY "items_insert_own" ON public.items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only the owner can update their own items
CREATE POLICY "items_update_own" ON public.items
  FOR UPDATE USING (auth.uid() = user_id);

-- Only the owner can delete their own items
CREATE POLICY "items_delete_own" ON public.items
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. Storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Storage RLS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "item_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "item_images_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "item_images_owner_delete"  ON storage.objects;

-- Anyone can view images
CREATE POLICY "item_images_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-images');

-- Authenticated users can upload (server enforces folder = user_id)
CREATE POLICY "item_images_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'item-images' AND
    auth.uid() IS NOT NULL
  );

-- Users can only delete their own files (folder name = user_id)
CREATE POLICY "item_images_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'item-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 5. Bookings table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id      UUID          NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  start_date   DATE          NOT NULL,
  end_date     DATE          NOT NULL,
  total_price  NUMERIC(10,2) NOT NULL CHECK (total_price > 0),
  status       TEXT          NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','cancelled','completed')),
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  CONSTRAINT   booking_dates_valid CHECK (end_date > start_date)
);

-- ── 6. Row-Level Security for bookings ───────────────────────────────────────
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select_own"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own"  ON public.bookings;

-- Renters see only their own bookings
CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Only the renter can create their own booking row
CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own pending bookings
CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- ── 8. Messages table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text TEXT         NOT NULL CHECK (char_length(message_text) BETWEEN 1 AND 1000),
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  CONSTRAINT   no_self_msg  CHECK (sender_id <> receiver_id)
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own"         ON public.messages;

CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ── 9. Public profiles (username lookup) ─────────────────────────────────────
-- Needed because auth.users is not queryable via user-scoped JWTs.
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;

CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_owner_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users who signed up before this script ran
INSERT INTO public.profiles (id, username)
SELECT id, COALESCE(raw_user_meta_data->>'username', 'user_' || LEFT(id::text, 8))
FROM   auth.users
ON CONFLICT (id) DO NOTHING;

-- ── 7. Availability-check function (SECURITY DEFINER) ─────────────────────────
-- Runs as the function owner (postgres), bypassing RLS so the server can
-- detect overlapping bookings without exposing other users' data.
CREATE OR REPLACE FUNCTION public.check_booking_overlap(
  p_item_id   UUID,
  p_start_date DATE,
  p_end_date   DATE
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE  item_id    = p_item_id
      AND  status     IN ('pending', 'confirmed')
      AND  start_date <  p_end_date
      AND  end_date   >  p_start_date
  );
$$;
