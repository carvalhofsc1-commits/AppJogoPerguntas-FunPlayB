import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hbgqgaemtjguscnpjgry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZ3FnYWVtdGpndXNjbnBqZ3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTU4OTEsImV4cCI6MjA5MTk3MTg5MX0.mRtrKbZzYVfBKTZLtm28SMeQJOCfxunfTDv_OFnR71I'
);

async function main() {
  const { data } = await supabase.from('questions').select('id, statement');
  console.log('Fetched rows without limit:', data ? data.length : 0);
}

main();
