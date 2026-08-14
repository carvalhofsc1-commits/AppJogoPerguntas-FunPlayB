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
  const { count: totalApproved } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aprovada');

  console.log('Total de perguntas aprovadas no banco:', totalApproved);
}

main();
