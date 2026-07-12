
REVOKE ALL ON FUNCTION public.career_pack_is_servable(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_active_career_pack(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_and_bind_career_pack(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_packs_reject_mutations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_pack_events_reject_mutations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.role_pack_bindings_check_servable() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.career_pack_is_servable(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_active_career_pack(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_and_bind_career_pack(uuid, text) TO service_role;
