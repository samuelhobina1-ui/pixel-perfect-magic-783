DROP POLICY IF EXISTS "read settings" ON public.settings;
CREATE POLICY "admin read settings" ON public.settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.public_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select jsonb_build_object('opay_number',opay_number,'opay_name',opay_name,'whatsapp_number',whatsapp_number,'whatsapp_template',whatsapp_template) from settings where id=1 $$;
GRANT EXECUTE ON FUNCTION public.public_settings() TO anon, authenticated;