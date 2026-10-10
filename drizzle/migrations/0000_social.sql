CREATE TABLE public.reactions (user_id uuid NOT NULL, video_key text NOT NULL, value smallint NOT NULL CHECK (value IN (1,-1)), PRIMARY KEY (user_id, video_key));
GRANT SELECT ON public.reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reactions" ON public.reactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own reactions ins" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reactions upd" ON public.reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own reactions del" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.saves (user_id uuid NOT NULL, video_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, video_key));
GRANT SELECT, INSERT, DELETE ON public.saves TO authenticated;
GRANT ALL ON public.saves TO service_role;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saves sel" ON public.saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own saves ins" ON public.saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saves del" ON public.saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, author text NOT NULL DEFAULT 'user', video_key text NOT NULL, body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX comments_video_idx ON public.comments (video_key, created_at DESC);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read comments" ON public.comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own comments ins" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own comments del" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);