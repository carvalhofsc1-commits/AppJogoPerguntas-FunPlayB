# Relatório de Auditoria — FunPlayB (jogo-perguntas-app)

**Data da auditoria:** 14/08/2026
**Tipo:** Diagnóstico completo (nenhuma alteração de código foi feita)
**Método:** Leitura integral do código-fonte, execução de build/typecheck, varredura de padrões e revisão do schema do banco de dados.

---

## 1. Resumo executivo

O app é um jogo de perguntas bíblicas em React 18 + TypeScript + Vite, com backend em Supabase e empacotamento mobile via Capacitor. O **build e o typecheck passam sem erros**, então o app funciona no dia a dia. Porém a auditoria encontrou **4 problemas críticos de segurança/estabilidade**, sendo o mais grave o fato de as políticas de segurança (RLS) do banco Supabase estarem **completamente abertas** (`USING (true)`) em praticamente todas as tabelas — incluindo a tabela de jogadores, que guarda o PIN de login **em texto puro**. Isso permite que qualquer pessoa com a chave pública do app (visível no navegador) leia, altere ou apague qualquer dado do sistema diretamente pela API do Supabase, sem passar pelo aplicativo. Além disso, o app tem dois sistemas de armazenamento de perguntas paralelos e desconectados (um deles órfão, nunca lido), páginas e serviços mortos deixados no bundle, e dois arquivos centrais (`Play.tsx` com 3065 linhas e `Questions.tsx` com 2617 linhas) concentrando praticamente toda a lógica de UI, negócio e rede do projeto. Nenhum desses achados foi corrigido nesta etapa — este documento serve apenas como diagnóstico e checklist priorizado para as próximas ações.

---

## 2. Mapeamento do projeto

### 2.1 Stack

- **Linguagem/Framework:** TypeScript + React 18, bundler Vite 5.
- **Roteamento:** `react-router-dom` v6 (`BrowserRouter`).
- **Estado:** sem Redux/Zustand — Context API (`AuthContext`, `AudioContext`) + `useState`/`useRef` locais nos componentes. Nenhum `useReducer` é usado mesmo nos fluxos mais complexos.
- **Backend/dados:** Supabase (`@supabase/supabase-js`) como banco principal (Postgres + REST), sem uso do Supabase Auth nativo — autenticação 100% customizada.
- **Persistência local:** `sql.js` / `@capacitor-community/sqlite` (SQLite nativo no mobile) e `localStorage` (fallback web), usados por um subsistema de catálogo local hoje órfão (ver 2.4).
- **Mobile:** Capacitor 6 (Android/iOS), plugins de Haptics e Keep-Awake.
- **PWA:** `vite-plugin-pwa` + Workbox (service worker, manifest, cache).
- **Sem ESLint/linter configurado** — nenhum `.eslintrc`/dependência de eslint no `package.json`. A única checagem estática é o `tsc --noEmit` (que roda como parte do script `build`).

### 2.2 Estrutura de pastas (resumo)

```
src/
  main.tsx            → bootstrap (init DB local + sync catálogo + render)
  App.tsx             → rotas (react-router)
  context/             → AuthContext, AudioContext
  components/          → Navbar, ProtectedRoute, modais, avatar animado etc.
  pages/                → 22 páginas (Play, Questions, Settings, Home, Ranking, Login...)
  services/             → catalogService, communityService (legado), sessionService (morto), shareService (legado)
  db/localDb.ts         → camada SQLite/localStorage do catálogo local
  lib/supabase.ts       → client Supabase + helper de paginação
  types/                → game.ts e question.ts (dois modelos de "Question" divergentes — ver 3)
  data/official.seed.json → catálogo demo embutido (fallback)
supabase/
  schema.sql            → DESATUALIZADO, reflete só o modelo v1 legado
  migrations/            → 22 arquivos, fonte real da verdade do schema atual
android/                 → projeto Capacitor Android
public/data/official.json → catálogo "oficial" real (402 perguntas, 145 KB)
*.cjs, *.mjs (raiz)      → 12 scripts soltos de manutenção pontual (import, patch, query ad-hoc)
```

Tamanho dos arquivos TS/TSX mais relevantes (linhas):

| Arquivo | Linhas |
|---|---|
| `src/pages/Play.tsx` | 3065 |
| `src/pages/Questions.tsx` | 2617 |
| `src/pages/Settings.tsx` | 1729 |
| `src/pages/About.tsx` | 1262 |
| `src/pages/SelectTheme.tsx` | 775 |
| `src/pages/Users.tsx` | 698 |
| `src/components/AvatarAnimated.tsx` | 612 |

### 2.3 Ponto de entrada e fluxo geral

`src/main.tsx` executa uma função `boot()` assíncrona **antes** de montar o React:

```
await initLocalDb();               // abre SQLite/localStorage
await syncOfficialCatalog(remote); // fetch de public/data/official.json (145 KB, sem cache, sem timeout)
createRoot(...).render(<App/>);    // só então a árvore React é montada
```

Essa chamada é feita com `void boot()`, **sem `.catch`** — qualquer falha nesses dois passos deixa a tela em branco para sempre, sem qualquer mensagem (ver bug crítico C4).

`src/App.tsx` define as rotas: públicas (`/welcome`, `/login`, `/register`, `/recover-pin`) e protegidas via `<ProtectedRoute>` (`/`, `/profile`, `/ranking`, `/questions`, `/settings`, `/about`, `/select-theme`, `/play`, `/result`; `/users` exige admin). A rota `/groups` está comentada (feature desativada).

**Autenticação:** totalmente customizada via `AuthContext`, tabela própria `players` (nickname/e-mail + PIN de 4 dígitos), sessão em `localStorage`, sem token/JWT e sem expiração no servidor — ver problemas de segurança na seção 3.

### 2.4 Como as perguntas são armazenadas/carregadas

Existem **dois sistemas de dados paralelos**, e um deles é órfão:

- **Sistema A (órfão):** `official.seed.json` (2 perguntas demo, fallback) + `public/data/official.json` (402 perguntas reais) → sincronizados a cada boot pelo `catalogService.ts` → gravados em `localDb.ts` (SQLite/localStorage). **Nenhuma tela do app lê esse catálogo de volta** — o único leitor (`getAllPlayable()`) não é chamado em lugar nenhum do código atual. Ou seja, o app baixa e grava 402 perguntas a cada abertura, à toa, atrasando a primeira renderização.
- **Sistema B (real, usado no jogo):** `Play.tsx` e o painel admin `Questions.tsx` leem/escrevem diretamente na tabela `questions` do **Supabase**, junto com `themes`, `answered_questions`, `game_settings`. É esse o sistema que o jogo de fato usa em produção.

Pacotes de comunidade (`communityService.ts`, `shareService.ts`, páginas `CreatePack`, `ImportPack`, `CloudPack`, `ShareHub`) são explicitamente **legado desativado na v2** (stubs que retornam erro fixo), mas ainda fazem parte do bundle final.

### 2.5 Lógica principal do jogo

Toda a lógica vive em `src/pages/Play.tsx` (um único componente com ~35 `useState` e ~15 `useRef`, sem `useReducer`):

- **Pontuação:** pontos base por dificuldade (`pts_facil/medio/dificil`, padrão 5/10/22 — configurável via `game_settings`). Uso de ajuda no meio da pergunta aplica desconto percentual (`pts_help_penalty_pct`, padrão 50%). Erro desconta pontos fixos (`pts_wrong_penalty`, padrão 3), com piso em 0.
- **Avanço de perguntas:** `advanceQuestion()` incrementa o índice; ao chegar na última pergunta (ou exceder limite de erros), chama `finishGame()`.
- **Tempo:** `setInterval` de 1s, pausável durante fala do TTS ou microfone aberto; timeout conta como erro automático.
- **Fim de jogo:** `finishGame()` para timer/áudio, calcula penalidade de abandono e salva sessão + respostas no Supabase — mas essas chamadas são feitas **sem `await`** (fire-and-forget), o que é uma das causas de bug listadas abaixo.
- **Ranking:** calculado 100% no cliente, buscando a tabela `game_sessions` inteira (sem paginação) e agregando por jogador: `rankScore = total_score × (1 + aproveitamento) − ajudas × 2`.

---

## 3. Bugs e erros (priorizados por gravidade)

### Build/typecheck

- `npx tsc --noEmit` → **0 erros**.
- `npx vite build` → build concluído com sucesso; único aviso: chunk principal de **742.86 kB** (206 kB gzip) — sem code-splitting por rota (ver melhoria B11).

### 🔴 Críticos

**C1 — Row Level Security (RLS) totalmente aberta em praticamente todo o banco.**
`supabase/migrations/002_funplayb_schema.sql` (linhas 31, 46, 59, 90, 106, 142, 154, 177, 190, 205, 222, 236), `005_release_notes.sql`, `007_fix_release_notes_rls.sql`, `013_add_app_policies.sql`, `schema.sql`.
Todas as políticas usam `FOR ALL USING (true) WITH CHECK (true)` — ou seja, leitura, escrita, atualização e exclusão liberadas para qualquer requisição autenticada com a **anon key**, que é pública (embutida no bundle JS, visível em qualquer DevTools). Isso vale para `players`, `pin_recovery`, `themes`, `questions`, `answered_questions`, `game_settings`, `online_presence`, `game_sessions`, `game_groups`, `game_group_members`, `group_sessions`, `invites` e outras. O próprio comentário no schema admite a decisão: *"RLS: tabela aberta via anon key (segurança no app)"* — ou seja, a segurança depende inteiramente da lógica do front-end, que é trivialmente contornável chamando a API REST do Supabase diretamente.
**Cenário de falha concreto:** qualquer pessoa pode copiar a URL/anon key do Supabase (do próprio bundle público) e rodar `select * from players` via REST, obtendo nome, e-mail, telefone e PIN de todos os jogadores; ou fazer `update`/`delete` em qualquer sessão, pontuação, pergunta ou configuração do jogo.

**C2 — PIN de login armazenado e comparado em texto puro.**
`supabase/migrations/002_funplayb_schema.sql:20` (`pin text NOT NULL, -- 4 dígitos numéricos, texto simples`); `src/context/AuthContext.tsx:87-95` (a query de login traz a coluna `pin` para o navegador e compara `data.pin !== pin` em JavaScript no cliente); `src/pages/Register.tsx:87-94` (insert sem hash).
Combinado com C1, qualquer atacante lê todos os PINs em texto puro diretamente do banco. Mesmo isoladamente, um PIN de 4 dígitos (10.000 combinações) sem rate limiting é trivial de forçar por brute force.

**C3 — Recuperação de PIN não funciona de verdade.**
`src/pages/RecoverPin.tsx:39-54`. O fluxo gera um token e grava em `pin_recovery`, mas **nunca envia e-mail** — o próprio código admite isso em comentário ("em produção real enviaria... por ora exibimos na tela") e a "exibição" real é só `console.info('[DEV] Token: ...')`, invisível para qualquer usuário em produção. Resultado: "Esqueci meu PIN" está quebrado para todo usuário real, que fica travado na etapa de verificação.

**C4 — Boot da aplicação sem tratamento de erro (tela branca permanente).**
`src/main.tsx:8-19`. `boot()` é chamado com `void boot()`, sem `.catch`. Se `initLocalDb()` (SQLite/localStorage) ou `syncOfficialCatalog()` (fetch de rede) falhar — por exemplo, sem conexão, storage cheio ou API fora do ar — a Promise rejeita silenciosamente e `createRoot(...).render(<App/>)` nunca é executado. O usuário vê uma tela branca, sem qualquer mensagem de erro, sem forma de recuperação a não ser recarregar (e só funciona se a causa raiz tiver sido transitória).

### 🟡 Médios

**M1 — ~26% do catálogo "oficial" com `correctIndex` fora do intervalo válido.**
`public/data/official.json` (402 perguntas): 104 perguntas têm `correctIndex: 4` (array `options` só vai de 0 a 3). Ex.: pergunta `official:00012` ("filho de Abraão e Sara") tem `correctIndex: 4`, mas a resposta certa ("Isaque") está no índice 3 — indício de que a fonte usa numeração 1-based e todo o catálogo está deslocado em −1. Hoje sem efeito prático (pipeline órfão, ver M2), mas é uma bomba-relógio caso o catálogo seja reativado sem correção.

**M2 — Dois sistemas de dados de perguntas desconectados; sincronização inútil no boot.**
`src/db/localDb.ts`, `src/services/catalogService.ts` fazem fetch + gravação de 402 perguntas a cada abertura do app (sem `AbortController`/timeout), atrasando a primeira renderização (ver C4), mas nada no app consome esses dados de volta.

**M3 — Tabelas `question_audit` e `theme_cycles` usadas no código mas inexistentes no schema.**
`src/pages/Play.tsx:1120,1134`; `src/pages/Questions.tsx:1199,1312,1319,1345,1352,1528`. Nenhuma migration cria essas tabelas (confirmado por busca em `supabase/migrations/` e `schema.sql`). Todo insert/select contra elas falha silenciosamente porque o código não verifica `error` nas respostas do Supabase nesses pontos — a funcionalidade de auditoria de respostas e ciclo de repetição de temas nunca funciona, sem qualquer aviso a devs ou usuários.

**M4 — Penalidade de ajuda pode não ser aplicada por closure obsoleta.**
`src/pages/Play.tsx:1930` e `:1963`. `handleSubmitAnswer` (um `useCallback`) lê `helpsThisQuestion`, mas essa variável não está na dependency array (`[phase, selectedLetter, idx, questions, errors, stopTimer, markAnswered, playSfx, timeLeft, recordAudit, finishGame]`) — a função só é recriada quando `timeLeft` muda (a cada 1s). **Cenário:** jogador usa uma ajuda e responde no mesmo segundo → a função ainda "vê" `helpsThisQuestion = 0` e concede pontuação cheia quando deveria aplicar o desconto.

**M5 — `finishGame()` salva sessão/respostas sem `await` nem tratamento de cancelamento.**
`src/pages/Play.tsx:1415-1465`. Se o usuário navegar para outra tela logo após o fim do jogo, as chamadas de rede (`saveSession`, `batchSaveAnswered`) podem ser abortadas antes de completar — perda silenciosa do resultado da partida.

**M6 — Erros do Supabase ignorados em múltiplos pontos** (sem checar o campo `error` da resposta):
- `src/pages/RecoverPin.tsx:28-36, 63-69` — falha de rede é reportada ao usuário como "e-mail não encontrado" (mensagem enganosa).
- `src/context/AuthContext.tsx:49-76` (`fetchBetaMsg`).
- `src/lib/supabase.ts:26-27` (`fetchAllPages` — em erro, apenas dá `break` e devolve dados parciais sem avisar quem chamou; pode causar perguntas repetidas indevidamente).
- `src/pages/Play.tsx:1112-1144` (`recordAudit`, ligado ao M3).

**M7 — Uso inconsistente de `supabase!` (non-null assertion) vs. checagem defensiva.**
`RecoverPin.tsx`, `Register.tsx`, `ReleaseNotesModal.tsx` usam `supabase!` e quebram com `TypeError` se as variáveis de ambiente do Supabase não estiverem configuradas; outros arquivos (`AuthContext`, `AudioContext`, `Navbar`) fazem `if (!supabase) return`.

**M8 — Condição de corrida (TOCTOU) na checagem de nickname único no cadastro.**
`src/pages/Register.tsx:53-65` (debounce de 600ms sem cancelar chamada anterior — respostas fora de ordem podem deixar `nicknameStatus === 'ok'` para um nickname diferente do digitado) e gap entre essa checagem e o `insert` real (linha ~87). O banco tem `UNIQUE` em `nickname`/`email` (mitiga duplicação real), mas o erro de violação de constraint não é tratado de forma específica no catch do insert.

**M9 — `supabase/schema.sql` desatualizado.**
Define apenas o modelo v1 legado (`question_packs`/`pack_questions`); não inclui `players`, `questions`, `themes`, `game_sessions`, `game_settings` etc. (só existem nas migrations). Rodar `schema.sql` do zero produz um banco incompleto.

**M10 — Duas migrations numeradas "005".**
`005_add_beta_message.sql` e `005_release_notes.sql` — ordem de aplicação ambígua/dependente do nome completo do arquivo.

**M11 — Ranking calculado no cliente sem paginação.**
`src/pages/Ranking.tsx:74-76` — busca a tabela `game_sessions` inteira a cada visita à tela, sem `.limit()`; degrada com o crescimento da base e (agravado por C1) expõe sessões de todos os jogadores ao cliente.

**M12 — Código morto com schema divergente do real.**
`src/services/sessionService.ts` não é importado em lugar nenhum do projeto e grava campos (`player_name`, `difficulty`) incompatíveis com o schema real usado por `Play.tsx`/`Ranking.tsx` (`player_id`, `correct_answers`, `errors`, `mode`). Risco de reativação incorreta no futuro.

**M13 — `src/pages/Result.tsx` é uma página órfã.**
A rota `/result` existe e é referenciada na `Navbar`, mas o fluxo do jogo nunca navega até ela — `Play.tsx` usa um `ResultOverlay` interno para mostrar o resultado. Acessar `/result` diretamente pela URL redireciona de volta para `/` (sem `location.state`). Duas implementações divergentes da mesma tela de resultado mantidas em paralelo.

**M14 — `getAllPlayable()` sem tratamento de erro no parse.**
`src/db/localDb.ts` (modo web) faz `JSON.parse(r.payload)` sem try/catch — dado corrompido no `localStorage` (ex.: por quota excedida) derruba a leitura com exceção não tratada.

**M15 — `parseOfficialLine.ts` sem checagem de `NaN`.**
`src/utils/parseOfficialLine.ts:17,27` — `parseInt()` para `points`/`correctIndex` sem validar o resultado; uma linha malformada na fonte gera pergunta com `NaN` aceita silenciosamente.

### 🟢 Baixos

- **B1** `src/context/AuthContext.tsx:167-194` — timeout de inatividade de 5 min pode deslogar o jogador no meio de uma partida (confirmar se é intencional).
- **B2** `src/App.tsx:75` — `import` no meio do arquivo (funciona por hoisting, mas é um code smell); rota `/groups` comentada (código morto).
- **B3** `src/lib/version.ts:5` — texto de notas de versão menciona "venda TT (Transferência de Titularidade)" e "comissão", sem relação com um jogo bíblico — indício de copy-paste de outro projeto, exibido ao usuário/log.
- **B4** `src/components/Navbar.tsx:71-84` — `if/else` redundante (`typeof path === 'number' ? navigate(path) : navigate(path)` — os dois branches são idênticos).
- **B5** `src/context/AudioContext.tsx` — sem cleanup do `AudioContext` (Web Audio API) no unmount (impacto baixo, componente vive na raiz do app).
- **B6** Duplicação de lógica de manipulação de PIN (`replace(/\D/g,'').slice(0,4)`) e de formulário entre `Login.tsx`, `Register.tsx` e `RecoverPin.tsx`.
- **B7** `AuthContext.tsx` (213 linhas) mistura 4 responsabilidades: autenticação, presença online, controle de ociosidade e busca de mensagem beta.
- **B8** 7 blocos `catch` vazios em `Play.tsx` (linhas 592, 599, 1593, 1638, 1795, 1803, 2207), todos engolindo erros do Web Speech API sem log.
- **B9** `(window as any)._lastAnswerTime` (`Play.tsx:1925`) e `window._forceStopAll`/`window.__funplaybCtx` (`AudioContext.tsx`) — uso do objeto `window` global como armazenamento ad-hoc, fora do padrão React usado no resto do projeto.
- **B10** Dois tipos `Question` com o mesmo nome e campos incompatíveis (`src/types/question.ts` vs `src/types/game.ts`) — risco de import errado via autocomplete.
- **B11** Nomenclatura inconsistente `camelCase`/`snake_case` misturada nos mesmos arquivos (ex.: `correct_answers` vindo do Supabase junto de `corrects` local em `Play.tsx`).

---

## 4. Organização e qualidade do código

- **Arquivos grandes demais / múltiplas responsabilidades:**
  - `src/pages/Play.tsx` (3065 linhas) — mistura UI, máquina de estados do jogo, integração de áudio/TTS, reconhecimento de voz (Web Speech API), animações de sorteio, vibração (Capacitor Haptics), chamadas diretas ao Supabase e regras de pontuação, tudo num único componente. É de longe o maior risco estrutural do projeto.
  - `src/pages/Questions.tsx` (2617 linhas) — CRUD completo de perguntas/temas, revisão/aprovação e moderação num único arquivo.
  - `src/pages/Settings.tsx` (1729 linhas) e `src/pages/About.tsx` (1262 linhas) também concentram bastante lógica.
- **Falta de separação entre lógica de negócio, UI e dados:** não existe camada de serviço para as tabelas realmente usadas (`questions`, `themes`, `game_sessions`) — as chamadas ao Supabase ficam espalhadas dentro dos componentes de página. A única camada de serviço "de verdade" (`catalogService`) atende justamente o sistema órfão (Sistema A).
- **Código morto/legado ainda no bundle:** `CreatePack.tsx`, `ImportPack.tsx`, `CloudPack.tsx`, `ShareHub.tsx`, `communityService.ts`, `shareService.ts` (stubs "desativado na v2"), `sessionService.ts` (nunca importado), `Result.tsx` (rota inalcançável na prática). Contribuem para o aviso de bundle grande no build.
- **Tipagem fraca:** 103 ocorrências de `any`/`as any` em todo o `src`, concentradas em `Questions.tsx` (28), `Play.tsx` (22), `Settings.tsx` (13), `SelectTheme.tsx` (10) e `AudioContext.tsx` (10) — reduz a garantia que o `strict: true` do `tsconfig.json` deveria oferecer.
- **Sem linter:** nenhum ESLint configurado — nada pega automaticamente problemas como dependências erradas de hooks (caso M4) antes de chegar em produção.
- **UI com `window.confirm`/`window.alert`:** 66 ocorrências no projeto, inconsistente com o restante da UI (que usa modais próprios) e não estilizável/acessível.
- **CSS:** `src/index.css` tem 7047 linhas; existe também um arquivo morto e não referenciado `src/index.css.step1.css` (3933 linhas), resíduo de alguma refatoração anterior que nunca foi removido.
- **Bundle:** build final gera um único chunk de 742 KB (206 KB gzip) sem code-splitting por rota — Vite já avisa sobre isso.
- **Raiz do projeto poluída:** 12 scripts soltos (`apply_migration.cjs`, `count_all.mjs`, `import_perguntas_html.cjs`, `patch_layout.cjs`, `patch_layout2.cjs`, `query_824.cjs`/`.mjs`, `query_daniel.mjs`, `query_theme.mjs`, `rewrite_emojis.cjs`, `test_limit.mjs`, `update_824.mjs`) de manutenção pontual (import de dados, patch de layout, queries ad-hoc), fora de uma pasta `scripts/` dedicada. Vários (`query_daniel.mjs`, `count_all.mjs`, `test_limit.mjs`, `import_perguntas_html.cjs`) têm a **anon key do Supabase hardcoded no arquivo** em vez de lida do `.env` (é a chave pública, não a `service_role`, mas ainda é má prática e polui o repositório).
- **Projeto não está sob controle de versão:** não há repositório Git inicializado — não há histórico de mudanças nem forma segura de reverter alterações.
- **Nomenclatura:** mistura consistente de português/inglês (aceitável dentro do domínio do app), mas identificadores pouco descritivos aparecem pontualmente (`sb` como alias do client Supabase em `Navbar.tsx`, `sess`, `betaMessage`).

---

## 5. Melhorias sugeridas (priorizadas)

### Prioridade 1 — Segurança (fazer antes de qualquer outra coisa)

1. Reescrever as políticas RLS de todas as tabelas do Supabase com regras reais (por linha/coluna), eliminando todo `USING (true) WITH CHECK (true)` — começar pela tabela `players`.
2. Parar de trazer a coluna `pin` para o cliente. Mover a validação de login para uma Edge Function/RPC no servidor, com o PIN armazenado com hash (bcrypt/argon2), nunca em texto puro.
3. Adicionar rate limiting ao login (por IP e/ou por nickname) para impedir brute force do PIN de 4 dígitos.
4. Implementar o envio real de e-mail na recuperação de PIN (Edge Function + provedor de e-mail) ou remover a tela até estar pronta, para não deixar usuários travados.
5. Remover as credenciais hardcoded dos scripts soltos na raiz; mover esses scripts para fora do repositório versionado ou fazê-los ler credenciais do `.env`.

### Prioridade 2 — Estabilidade

6. Adicionar tratamento de erro ao `boot()` em `main.tsx` (try/catch com fallback de UI de erro, em vez de tela branca).
7. Corrigir a dependency array de `handleSubmitAnswer` em `Play.tsx` (incluir `helpsThisQuestion`) e revisar os demais `useCallback`/`useEffect` do arquivo quanto ao mesmo padrão.
8. Tratar/logar os erros hoje ignorados nas chamadas Supabase (`recordAudit`, `fetchAllPages`, `RecoverPin`, `fetchBetaMsg`), padronizando o uso de `supabase!` vs. checagem defensiva em todo o projeto.
9. Decidir o destino de `question_audit`/`theme_cycles`: criar as migrations que faltam ou remover o código morto que as referencia.
10. Corrigir a convenção de índice (1-based vs. 0-based) no catálogo `public/data/official.json`, mesmo que hoje esteja órfão — ou removê-lo junto com o Sistema A inteiro (ver item 12).

### Prioridade 3 — Organização e manutenibilidade

11. Quebrar `Play.tsx` e `Questions.tsx` em hooks customizados (`useGameTimer`, `useGameScore`, `useVoiceControl`, `useSpeechRecognition` etc.) e componentes menores.
12. Remover código morto: Sistema A de dados órfão (`localDb.ts`/`catalogService.ts`, se de fato não for reaproveitado), `sessionService.ts`, `Result.tsx`, e as páginas/serviços "desativados na v2" — ou reativá-los de fato, se ainda fizerem parte do roadmap.
13. Atualizar `supabase/schema.sql` para refletir o schema real (ou removê-lo, deixando as migrations como única fonte da verdade).
14. Adicionar ESLint com `eslint-plugin-react-hooks` ao projeto, para pegar automaticamente bugs de dependency array como o M4 antes de chegarem à produção.
15. Reduzir o uso de `any`, começando pelos arquivos mais críticos (`Play.tsx`, `Questions.tsx`).
16. Aplicar code-splitting por rota (`React.lazy`) para reduzir o chunk único de 742 KB.
17. Remover `src/index.css.step1.css` (morto) e avaliar dividir `index.css` por página/componente.
18. Substituir `window.confirm`/`window.alert` por modais próprios do app.
19. Inicializar um repositório Git para o projeto, se ainda não fizer parte do fluxo de trabalho atual.

---

*Este relatório é apenas diagnóstico — nenhuma alteração foi feita no código-fonte ou no banco de dados durante esta auditoria.*
