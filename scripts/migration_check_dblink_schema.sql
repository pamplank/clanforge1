select extname, extnamespace::regnamespace as schema
from pg_extension
where extname = 'dblink';
