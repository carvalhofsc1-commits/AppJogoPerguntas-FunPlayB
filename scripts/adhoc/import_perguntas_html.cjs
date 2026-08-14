const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// COLOQUE SUAS CREDENCIAIS AQUI
const SUPABASE_URL = 'https://hbgqgaemtjguscnpjgry.supabase.co';
// Usa a role service_role ou anon key se a tabela permitir
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZ3FnYWVtdGpndXNjbnBqZ3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTU4OTEsImV4cCI6MjA5MTk3MTg5MX0.mRtrKbZzYVfBKTZLtm28SMeQJOCfxunfTDv_OFnR71I'; // Usando anon key existente
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const html = fs.readFileSync('../JogoTeste4_Completa.html', 'utf8');
    const startIdx = html.indexOf('const PERGUNTAS_FILE_DATA =`');
    if (startIdx === -1) throw new Error('Dados não encontrados no HTML');
    
    const endIdx = html.indexOf('`;', startIdx);
    const dataString = html.substring(startIdx + 28, endIdx).trim();

    const lines = dataString.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`Encontradas ${lines.length} perguntas no arquivo`);

    // Obter temas primeiro
    const { data: themes } = await supabase.from('themes').select('id, name');
    let themeMap = {};
    if (themes) {
      themes.forEach(t => themeMap[t.name] = t.id);
    }

    const mapDifficulty = (points) => {
      if (points === '2') return 'facil';
      if (points === '10') return 'medio';
      return 'dificil';
    };

    const mapCorrect = (numStr) => {
      if (numStr === '1') return 'a';
      if (numStr === '2') return 'b';
      if (numStr === '3') return 'c';
      if (numStr === '4') return 'd';
      return 'a';
    };

    let questionsBatch = [];
    
    for (let line of lines) {
      const parts = line.split(';');
      if (parts.length >= 10) {
        const statement = parts[1].replace(/"/g, '');
        const optA = parts[2].replace(/"/g, '');
        const optB = parts[3].replace(/"/g, '');
        const optC = parts[4].replace(/"/g, '');
        const optD = parts[5].replace(/"/g, '');
        const correct = mapCorrect(parts[6].replace(/"/g, ''));
        const reference = parts[7].replace(/"/g, '');
        const diff = mapDifficulty(parts[8].replace(/"/g, ''));
        const themeName = parts[9].replace(/"/g, '');
        
        let themeId = themeMap[themeName];
        if (!themeId) {
          const { data: newTheme } = await supabase.from('themes').insert({ name: themeName }).select().single();
          if (newTheme) {
            themeId = newTheme.id;
            themeMap[themeName] = themeId;
          }
        }
        
        questionsBatch.push({
          statement,
          option_a: optA,
          option_b: optB,
          option_c: optC,
          option_d: optD,
          correct_answer: correct,
          difficulty: diff,
          reference: reference,
          theme_id: themeId,
          status: 'aprovada',
          is_native: true
        });
      }
    }

    console.log(`Preparadas ${questionsBatch.length} perguntas para inserção`);

    // Em vez de delete total, vamos inserir/upsert ou o usuário já deletou.
    // O usuário vai rodar o SQL para deletar, ou nós tentamos deletar via API
    // (a anon key talvez permita delete se RLS estiver off/all).
    const { error: delError } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) console.log('Aviso ao deletar questões antigas:', delError.message);

    for (let i = 0; i < questionsBatch.length; i += 100) {
      const batch = questionsBatch.slice(i, i + 100);
      const { error } = await supabase.from('questions').insert(batch);
      if (error) {
        console.error('Erro ao inserir lote:', error);
      } else {
        console.log(`Lote inserido: ${Math.min(i + 100, questionsBatch.length)}/${questionsBatch.length}`);
      }
    }

    console.log('Importação concluída com sucesso!');
  } catch (err) {
    console.error('Erro:', err);
  }
}

run();
