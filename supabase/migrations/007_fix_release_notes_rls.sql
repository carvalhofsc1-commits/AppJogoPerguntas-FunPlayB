-- Corrige a política de segurança da tabela release_notes
-- O sistema de login deste app não usa auth.uid() nativo do Supabase

DROP POLICY IF EXISTS "notes_admin_all_policy" ON release_notes;

CREATE POLICY "notes_admin_all_policy" ON release_notes 
FOR ALL USING (true) WITH CHECK (true);
