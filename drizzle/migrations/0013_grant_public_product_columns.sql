GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT (id, name, category_id, price_naira, image_url, description, how_to_use, status, deleted_at, created_at, updated_at, fulfillment_type, clubkonnect_network, clubkonnect_plan_code, clubkonnect_plan_name) ON public.products TO anon, authenticated;