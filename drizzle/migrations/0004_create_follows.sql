CREATE TABLE public.follows (
  follower_id uuid not null,
  followee_id uuid not null,
  created_at timestamptz not null default now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read follows" ON public.follows FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own follows ins" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "own follows del" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);