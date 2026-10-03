BEGIN;

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT true;
$function$;

REVOKE ALL ON FUNCTION public.keepalive() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.keepalive() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.keepalive() TO anon;

COMMIT;
