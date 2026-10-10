ALTER TABLE public.driver_ratings
  ADD CONSTRAINT driver_ratings_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE CASCADE;

ALTER TABLE public.driver_ratings
  ADD CONSTRAINT driver_ratings_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.driver_ratings
  ADD CONSTRAINT driver_ratings_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;