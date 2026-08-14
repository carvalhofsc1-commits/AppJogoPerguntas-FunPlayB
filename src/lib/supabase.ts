import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(url && key);

// Cliente único para toda a app — sem Supabase Auth
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/**
 * Busca TODOS os registros de uma query Supabase contornando o limite padrão de 1000 linhas.
 * Recebe uma função que cria a query com `.range(from, to)` e faz paginação automática.
 */
export async function fetchAllPages<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const PAGE = 1000;
  let allData: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allData;
}

