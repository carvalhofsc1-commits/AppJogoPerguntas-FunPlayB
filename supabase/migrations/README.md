# Migrations — notas

Aplicar em ordem numérica. Duas observações:

- **`005_add_beta_message.sql` e `005_release_notes.sql`** têm o mesmo número por engano — as duas já foram aplicadas em produção, então não foram renomeadas (evitar risco de confundir alguma ferramenta que rastreie migrations por nome de arquivo). A partir da 006 a numeração segue normal.
- **Nem todo o schema real está documentado aqui.** Algumas colunas/tabelas foram criadas direto no SQL Editor do Supabase sem virar migration — ver aviso no topo de `supabase/schema.sql` para a lista conhecida (`players.status`, `question_audit`, `theme_cycles`). Antes de assumir que uma tabela/coluna não existe só porque não está em nenhum arquivo aqui, confirme direto no banco.
