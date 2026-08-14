import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].trim();
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

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
