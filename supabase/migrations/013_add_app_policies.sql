-- Migration: Create app_policies table for Privacy Policy and Terms of Use
CREATE TABLE IF NOT EXISTS public.app_policies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type text UNIQUE NOT NULL CHECK (policy_type IN ('privacy_policy_terms')),
  content     text NOT NULL,
  updated_at  timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_policies_all" ON public.app_policies FOR ALL USING (true) WITH CHECK (true);

-- Insert default Terms & Privacy Policy incorporating all requested details
INSERT INTO public.app_policies (policy_type, content) VALUES
('privacy_policy_terms', 'POLÍTICA DE PRIVACIDADE E DIREITOS AUTORAIS

1. INTRODUÇÃO E RESPONSABILIDADE
Ao se cadastrar e utilizar o FunPlayB, você concorda integralmente com estes termos de uso. O desenvolvedor do aplicativo disponibiliza a plataforma para entretenimento e aprendizado, mas NÃO se responsabiliza pelo teor, exatidão ou legalidade das perguntas, respostas e fontes criadas ou importadas pelos usuários.

2. RESPONSABILIDADE LEGAL INDIVIDUAL
Cada usuário é responsável única, exclusiva e legalmente pelo conteúdo de toda e qualquer pergunta, resposta e fonte (referência bibliográfica) que criar, importar ou editar. É expressamente proibida a criação ou importação de qualquer conteúdo que contenha teor ofensivo, depreciativo, preconceituoso, difamatório, vulgar ou que viole as leis vigentes.

3. MODERAÇÃO E REVISÃO DE CONTEÚDO
O jogador aceita voluntariamente que todas as perguntas criadas ou importadas serão submetidas a uma fila de moderação, sendo revisadas pelos administradores/moderadores antes de serem aprovadas e integradas ao banco de dados público do jogo.

4. CONTEÚDO E DIRETRIZES TEMÁTICAS
O aplicativo aceita perguntas sobre assuntos bíblicos/religiosos, bem como temas acadêmicos, educacionais ou universitários gerais.
No entanto, perguntas de conteúdo bíblico ou de temática religiosa correlata SÓ serão validadas e aprovadas se estiverem em perfeita conformidade com as doutrinas, ensinamentos e interpretações praticadas pelas Testemunhas de Jeová, devendo ser estritamente baseadas na Bíblia Sagrada e em suas publicações oficiais.

5. DIREITOS AUTORAIS E LICENÇA DE USO
Ao submeter qualquer conteúdo (perguntas, respostas, fontes, imagens) no FunPlayB, o usuário concede ao aplicativo uma licença perpétua, global e gratuita para exibir, reproduzir, distribuir e moderar tais conteúdos dentro das funcionalidades do jogo. O usuário declara possuir os direitos ou autorizações necessárias sobre as referências bibliográficas citadas.')
ON CONFLICT (policy_type) DO NOTHING;
