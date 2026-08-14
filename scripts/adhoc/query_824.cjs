import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('questions')
    .select('*, creator:players!questions_created_by_fkey(nickname)')
    .eq('question_number', 824);

  if (error) {
    console.error('Error fetching question:', error);
  } else {
    console.log('Question 824:', JSON.stringify(data, null, 2));
  }
}

run();
