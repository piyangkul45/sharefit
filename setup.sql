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
