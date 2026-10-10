ALTER TABLE public.order_items
  DROP CONSTRAINT order_items_product_id_fkey,
  ADD CONSTRAINT order_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON DELETE SET NULL;