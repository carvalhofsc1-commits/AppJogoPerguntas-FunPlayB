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
    .update({ 
      is_native: false, 
      created_by: '86b21eed-7257-45a5-84cd-2989f61398ef' 
    })
    .eq('question_number', 824)
    .select('question_number, is_native, created_by, creator:players!questions_created_by_fkey(nickname)');

  if (error) {
    console.error('Error updating question:', error);
  } else {
    console.log('Update successful:', JSON.stringify(data, null, 2));
  }
}

run();
