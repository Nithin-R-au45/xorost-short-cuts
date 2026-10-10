CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos readable" ON public.videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own videos insert" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own videos update" ON public.videos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own videos delete" ON public.videos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.video_segments (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  idx int NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  PRIMARY KEY (video_id, idx)
);
GRANT SELECT ON public.video_segments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_segments TO authenticated;
GRANT ALL ON public.video_segments TO service_role;
ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "segments readable" ON public.video_segments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner writes segments" ON public.video_segments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.user_id = auth.uid()));

CREATE POLICY "read videos files" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'videos');
CREATE POLICY "upload own videos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delete own videos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);