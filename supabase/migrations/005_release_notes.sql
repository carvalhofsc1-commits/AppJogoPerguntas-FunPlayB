CREATE TABLE IF NOT EXISTS release_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50) NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;

-- Politica: Todos podem ler
CREATE POLICY "notes_select_policy" ON release_notes FOR SELECT USING (true);

-- Politica: Apenas admin pode inserir/atualizar/deletar
CREATE POLICY "notes_admin_all_policy" ON release_notes 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM players p 
        WHERE p.id = auth.uid() AND p.category = 'admin'
    )
);

-- Inserir a primeira nota
INSERT INTO release_notes (version, notes) VALUES ('1.03.351', 'Atualizações recentes:\n- Melhorias no sistema de navegação e início de partidas.\n- Correção de bugs de exibição.');
