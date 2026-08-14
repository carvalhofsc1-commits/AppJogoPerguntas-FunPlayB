UPDATE public.themes
SET created_by = (SELECT id FROM public.players WHERE nickname ILIKE 'Fernando%' LIMIT 1)
WHERE name IN (
  'Profecias', 
  'Vida e Ministério de Jesus', 
  'Meu livro de Histórias Bíblicas',
  'Meu Livro de Histórias Bíblicas'
);
