/**
 * apply_migration.cjs
 * Aplica a migration 003_add_total_access.sql via API REST do Supabase.
 * 
 * USO:
 *   node apply_migration.cjs <SERVICE_ROLE_KEY>
 * 
 * A SERVICE_ROLE_KEY está no painel Supabase em:
 *   Project Settings → API → service_role (secret)
 */

const https = require('https');

const SUPABASE_URL = 'https://hbgqgaemtjguscnpjgry.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Informe a SERVICE_ROLE_KEY como argumento:');
  console.error('   node apply_migration.cjs <sua-service-role-key>');
  process.exit(1);
}

const SQL = `
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS total_access integer NOT NULL DEFAULT 0;

UPDATE public.players
  SET total_access = 1
  WHERE total_access = 0;
`;

const body = JSON.stringify({ query: SQL });
const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);

// O endpoint correto para SQL arbitrário via REST é o /rest/v1/rpc, 
// mas precisamos da edge function ou usar o endpoint de admin.
// Vamos usar o endpoint de SQL direto via Supabase Management API.
const options = {
  hostname: url.hostname,
  path: `/pg/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

// Usando a Management API do Supabase para executar SQL
const PROJECT_REF = 'hbgqgaemtjguscnpjgry';
const mgmtOptions = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('🔄 Aplicando migration: ADD COLUMN total_access...');

const req = https.request(mgmtOptions, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Migration aplicada com sucesso!');
      console.log('   Coluna total_access adicionada à tabela players.');
    } else {
      console.error(`❌ Erro HTTP ${res.statusCode}:`, data);
      console.log('\n💡 Execute manualmente o SQL no painel Supabase:');
      console.log('   https://supabase.com/dashboard/project/hbgqgaemtjguscnpjgry/sql/new');
      console.log('\n--- SQL para copiar e colar ---');
      console.log(SQL);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro de conexão:', e.message);
  console.log('\n💡 Execute manualmente o SQL no painel Supabase:');
  console.log('   https://supabase.com/dashboard/project/hbgqgaemtjguscnpjgry/sql/new');
  console.log('\n--- SQL para copiar e colar ---');
  console.log(SQL);
});

req.write(body);
req.end();
