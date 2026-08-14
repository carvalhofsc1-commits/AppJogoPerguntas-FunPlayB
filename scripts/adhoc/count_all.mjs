import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hbgqgaemtjguscnpjgry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZ3FnYWVtdGpndXNjbnBqZ3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTU4OTEsImV4cCI6MjA5MTk3MTg5MX0.mRtrKbZzYVfBKTZLtm28SMeQJOCfxunfTDv_OFnR71I'
);

async function main() {
  const { count: totalApproved } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aprovada');

  console.log('Total de perguntas aprovadas no banco:', totalApproved);
}

main();
