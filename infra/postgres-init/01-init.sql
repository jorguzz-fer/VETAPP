-- Inicialização do banco de DEV.
-- vetapp_admin (POSTGRES_USER) é superuser e aplica migrations/DDL e políticas RLS.
-- vetapp_app é o usuário da APLICAÇÃO: SEM superuser e SEM BYPASSRLS, para que o
-- Row-Level Security seja sempre aplicado (ver docs/spec/03-multitenancy.md).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vetapp_app') THEN
    CREATE ROLE vetapp_app LOGIN PASSWORD 'app_password' NOBYPASSRLS NOSUPERUSER;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE vetapp TO vetapp_app;
GRANT USAGE ON SCHEMA public TO vetapp_app;

-- Privilégios padrão para objetos criados pelo admin (migrations):
ALTER DEFAULT PRIVILEGES FOR ROLE vetapp_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vetapp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE vetapp_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vetapp_app;
