create extension if not exists dblink;

select extname, extnamespace::regnamespace as schema
from pg_extension
where extname = 'dblink';
