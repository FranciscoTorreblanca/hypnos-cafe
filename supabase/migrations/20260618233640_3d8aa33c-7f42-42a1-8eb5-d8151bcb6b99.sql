
REVOKE EXECUTE ON FUNCTION public.attempt_check_in(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.attempt_check_out(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_expired_sessions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_open_attendance_session() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_schedule_for(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attempt_check_in(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attempt_check_out(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_expired_sessions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_open_attendance_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_schedule_for(uuid, timestamptz) TO authenticated;
