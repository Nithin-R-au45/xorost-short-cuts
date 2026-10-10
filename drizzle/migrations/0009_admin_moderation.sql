CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.upload_blocks (user_id uuid PRIMARY KEY, reason text NOT NULL DEFAULT 'copyright', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_blocks TO authenticated;
GRANT ALL ON public.upload_blocks TO service_role;
ALTER TABLE public.upload_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks read" ON public.upload_blocks FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin blocks write" ON public.upload_blocks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.videos ADD COLUMN status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.videos ADD CONSTRAINT videos_status_check CHECK (status IN ('pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.moderate_video() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM upload_blocks WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Uploads are blocked for this account';
    END IF;
    NEW.status := CASE WHEN has_role(NEW.user_id,'admin') THEN 'approved' ELSE 'pending' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NOT has_role(auth.uid(),'admin') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderate_video BEFORE INSERT OR UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.moderate_video();

DROP POLICY "videos readable" ON public.videos;
CREATE POLICY "videos readable" ON public.videos FOR SELECT TO anon, authenticated USING (status = 'approved' OR auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin videos update" ON public.videos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin videos delete" ON public.videos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete video files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos' AND public.has_role(auth.uid(),'admin'));