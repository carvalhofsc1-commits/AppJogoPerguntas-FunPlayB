import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hbgqgaemtjguscnpjgry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZ3FnYWVtdGpndXNjbnBqZ3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTU4OTEsImV4cCI6MjA5MTk3MTg5MX0.mRtrKbZzYVfBKTZLtm28SMeQJOCfxunfTDv_OFnR71I'
);

async function main() {
  const { data: themes, error: tErr } = await supabase
    .from('themes')
    .select('id, name')
    .ilike('name', '%daniel%');

  if (tErr) { console.error('Erro ao buscar temas:', tErr.message); process.exit(1); }

  console.log(`\nTemas encontrados com "daniel":`);
  if (!themes || themes.length === 0) {
    console.log('  Nenhum tema encontrado.');
    process.exit(0);
  }

  for (const t of themes) {
    console.log(`\n  📚 Tema: "${t.name}" (id: ${t.id})`);

    const { count: total } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('theme_id', t.id);

    for (const status of ['aprovada', 'pendente', 'rejeitada', 'inativa']) {
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('theme_id', t.id)
        .eq('status', status);
      if (count && count > 0) console.log(`    ${status}: ${count}`);
    }

    console.log(`    TOTAL: ${total}`);
  }
}

main();
