revoke select on public.products from anon;
grant select (id, name, category_id, price_naira, image_url, description, how_to_use, status, deleted_at, created_at, updated_at) on public.products to anon;
create policy "anon read product images" on storage.objects for select to anon using (bucket_id='product-images');