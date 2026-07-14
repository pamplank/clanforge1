-- Diagnostic only, no changes. The REVOKE in verify_login.sql didn't
-- actually block anon's read access to members.password (confirmed via a
-- live select=* still returning it) -- this checks WHY, most likely
-- because the original privilege was granted to PUBLIC rather than to the
-- anon role specifically. Revoking from a specific role never overrides a
-- grant made to PUBLIC (every role, including anon, inherits from PUBLIC).
--
-- Run in the Supabase SQL Editor and share the output.
select grantee, privilege_type, is_grantable
from information_schema.role_column_grants
where table_name = 'members' and column_name = 'password'
order by grantee;
