CREATE TABLE public.video_views (
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  seconds int NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  max_part int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own views" ON public.video_views FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.video_popularity()
RETURNS TABLE (video_id uuid, viewers bigint, watch_seconds bigint, saves bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id,
    (SELECT count(*) FROM video_views w WHERE w.video_id = v.id),
    (SELECT coalesce(sum(w.seconds),0) FROM video_views w WHERE w.video_id = v.id),
    (SELECT count(*) FROM saves s WHERE s.video_key = 'vid:' || v.id::text)
  FROM videos v;
$$;
GRANT EXECUTE ON FUNCTION public.video_popularity() TO anon, authenticated;