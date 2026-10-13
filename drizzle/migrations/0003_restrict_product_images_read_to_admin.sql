drop policy if exists "public read product images" on storage.objects;
drop policy if exists "anon read product images" on storage.objects;
create policy "admin read product images" on storage.objects for select to authenticated using (bucket_id = 'product-images' and has_role(auth.uid(), 'admin'::app_role));