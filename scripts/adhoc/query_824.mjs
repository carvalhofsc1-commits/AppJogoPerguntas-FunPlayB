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

async function run() {
  const { data, error } = await supabase
    .from('questions')
    .select('*, creator:players!questions_created_by_fkey(nickname)')
    .eq('question_number', 824);

  if (error) {
    console.error('Error fetching question:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
