-- PostgREST (Supabase's REST API layer) caches table/column permissions in
-- memory for performance. A DDL change like the REVOKE in
-- revoke_password_select_only.sql takes effect in Postgres immediately,
-- but PostgREST won't reflect it in actual API responses until it reloads
-- its schema cache. This notification tells it to do that now, instead of
-- waiting for its own periodic/automatic reload.
notify pgrst, 'reload schema';
