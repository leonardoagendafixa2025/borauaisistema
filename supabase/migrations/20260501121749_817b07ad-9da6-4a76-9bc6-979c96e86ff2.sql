REVOKE EXECUTE ON FUNCTION public.approve_music_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_music_request(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_music_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_music_request(uuid, text) TO authenticated;