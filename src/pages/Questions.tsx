import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchAllPages } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Question, Theme } from '@/types/game';

/* ─── helpers ─────────────────────────────────────────────── */
const DIFFICULTIES = ['facil', 'medio', 'dificil'] as const;
const DIFF_LABEL: Record<string, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada', inativa: 'Inativa' };

const CSV_INSTRUCTIONS = `Estrutura do arquivo CSV (codificação UTF-8):

tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia

REGRAS (TODOS OS CAMPOS SÃO OBRIGATÓRIOS):
• Separador: ponto e vírgula (;)
• 1ª linha = cabeçalho (obrigatório, exatamente como acima)
• LIMITES: Tema (max 40), Enunciado (max 250), Opções A/B/C/D (max 100 cada), Referência (max 500 caracteres)
• resposta_correta: apenas a letra a, b, c ou d (minúscula)
• dificuldade: facil, medio ou dificil (sem acento)
• referencia (OBRIGATÓRIO): No texto da referência, informe exatamente qual o capítulo e parágrafo do livro (ou texto da Bíblia na Tradução do Novo Mundo) foi utilizado como base para a resposta certa, e cite entre aspas um trecho na íntegra do parágrafo/texto da Bíblia que justifique a resposta, talvez parte da frase em que a pergunta/resposta foi baseada.
• Campos com ponto e vírgula devem ser entre aspas duplas: "texto; com ponto e vírgula"
• Imagens devem ser adicionadas depois, na edição da pergunta

EXEMPLO:
tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia
Bíblia;Quem escreveu o Gênesis?;Moisés;Davi;Salomão;Paulo;a;facil;"Gênesis 1:1 - No princípio Deus criou os céus e a terra."`;

/* ── Modal de Exportação ── */
function ExportDialog({
  isAdmin, themes, onClose, onExportAll, onExportThemeCsv, onExportThemeText, copySuccess
}: {
  isAdmin: boolean; themes: Theme[]; onClose: () => void;
  onExportAll: () => void; onExportThemeCsv: (id: string) => void; onExportThemeText: (id: string) => void;
  copySuccess: string;
}) {
  const [selectedTheme, setSelectedTheme] = useState('');
  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-box">
        <h3 className="modal-title">📤 Exportar Perguntas</h3>
        <p style={{ marginBottom: '1rem', opacity: 0.9 }}>
          {isAdmin ? 'Como deseja exportar as perguntas?' : 'Deseja exportar todas as suas perguntas contribuídas para uma planilha CSV?'}
        </p>
        
        <button 
          className="btn-primary" 
          style={{ width: '100%', marginBottom: '1rem', padding: '1rem' }}
          onClick={onExportAll}
        >
          {isAdmin ? '🌐 Exportar Todas (CSV)' : '👤 Exportar Minhas Perguntas (CSV)'}
        </button>

        {isAdmin && (
          <div style={{ margin: '1rem 0', padding: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.7 }}>Ou escolha um tema específico:</p>
            <select 
              className="settings-select" 
              style={{ width: '100%', marginBottom: selectedTheme ? '0.5rem' : '1.5rem' }}
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
            >
              <option value="" disabled>Selecionar tema...</option>
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            
            {selectedTheme && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                <button className="btn-action-outline" style={{ padding: '0.8rem', fontSize: '0.9rem', borderColor: '#4cff91', color: '#4cff91' }} onClick={() => onExportThemeCsv(selectedTheme)}>
                  Baixar Tema como CSV
                </button>
                <button className="btn-action-yellow" style={{ padding: '0.8rem', fontSize: '0.9rem' }} onClick={() => onExportThemeText(selectedTheme)}>
                  Copiar p/ Área de Transferência
                </button>
              </div>
            )}
          </div>
        )}

        {copySuccess && (
          <div style={{ padding: '0.8rem', backgroundColor: 'rgba(76, 255, 145, 0.1)', color: '#4cff91', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>
            {copySuccess}
          </div>
        )}

        <button className="btn-action-outline" style={{ width: '100%' }} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ─── Modal de instruções CSV ─────────────────────────────── */
function CsvInstructionsModal({ aiPrompt, onClose }: { aiPrompt: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CSV_INSTRUCTIONS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPrompt = () => {
    const promptText = aiPrompt ? aiPrompt.trim() : '';
    if (!promptText) {
      alert('⚠️ Nenhum prompt foi configurado nos ajustes.');
      return;
    }
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    alert('📋 Prompt copiado com sucesso! Agora você pode colar na conversa com a sua IA.');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleDownload = () => {
    const csvContent = "tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia\nBíblia;Quem escreveu o Gênesis?;Moisés;Davi;Salomão;Paulo;a;facil;\"Gênesis 1:1 - No princípio Deus criou os céus e a terra.\"";
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Inclui BOM para o Excel ler acentos
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'exemplo_perguntas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', padding: '15px' }}>
          <h3 className="modal-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>📋 Instruções para importação CSV</h3>
          
          <div style={{ position: 'relative' }}>
            <pre className="csv-instructions" style={{ maxHeight: '180px', fontSize: '0.75rem', padding: '8px' }}>{CSV_INSTRUCTIONS}</pre>
            <button 
              className="btn-copy-instructions"
              onClick={handleCopy}
              title="Copiar instruções"
              style={{ padding: '2px 6px', fontSize: '0.65rem' }}
            >
              {copied ? '✅ Copiado!' : '📋 Copiar'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <button 
              className="btn-primary" 
              style={{ 
                width: '100%', 
                padding: '8px', 
                fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: '0 3px 6px rgba(124, 58, 237, 0.2)',
                margin: 0
              }}
              onClick={() => setShowPromptModal(true)}
            >
              🤖 Copiar prompt para IA
            </button>

            <button 
              className="btn-secondary" 
              onClick={handleDownload} 
              style={{ 
                width: '100%', 
                padding: '8px', 
                fontSize: '0.85rem',
                margin: 0
              }}
            >
              📥 Baixar CSV de Exemplo
            </button>

            <button 
              className="btn-primary" 
              onClick={onClose} 
              style={{ 
                width: '100%', 
                padding: '8px', 
                fontSize: '0.85rem',
                margin: 0
              }}
            >
              Entendi
            </button>
          </div>
        </div>
      </div>

      {showPromptModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowPromptModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 className="modal-title">💡 Instruções do Prompt para IA</h3>
            
            <div style={{ fontSize: '0.88rem', color: '#fff', opacity: 0.95, lineHeight: '1.5', textAlign: 'left', marginBottom: '1.2rem' }}>
              <p style={{ marginBottom: '0.8rem' }}>
                ⚠️ <strong>Atenção:</strong> O texto a ser copiado é apenas uma sugestão padrão e precisa ser adaptado antes do envio.
              </p>
              <p style={{ marginBottom: '0.8rem' }}>
                No prompt sugerido, é proposta a criação de <strong>30 perguntas</strong>. Ao colar o texto na sua IA, lembre-se de:
              </p>
              <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Preencher o campo <strong>Tema das perguntas</strong> no texto (substituindo a marcação entre colchetes).</li>
                <li><strong>Anexar na mesma conversa</strong> o material de base (que pode ser um arquivo PDF da publicação, um link com o endereço da publicação, ou outro formato que a IA aceite).</li>
              </ul>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-primary" 
                onClick={handleCopyPrompt}
                style={{ flex: 1, padding: '0.8rem', background: '#4ade80', color: '#000', fontWeight: 'bold' }}
              >
                {copiedPrompt ? '✅ Copiado!' : '📋 COPIAR PROMPT'}
              </button>
              <button className="btn-action-outline" onClick={() => setShowPromptModal(false)} style={{ flex: 1 }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Tipos auxiliares de importação ─────────────────────── */
interface ParsedQuestion {
  tema: string;
  enunciado: string;
  oa: string; ob: string; oc: string; od: string;
  resp: string;
  diff: string;
  ref: string;
  valid: boolean;
  error?: string;
  existingId?: string;
}

interface ImportStats {
  total: number;
  valid: number;
  invalid: number;
  temas: Record<string, number>;
  facil: number;
  medio: number;
  dificil: number;
  parsed: ParsedQuestion[];
  dbDuplicatesCount?: number;
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuote = !inQuote;
    
    if (ch === '\n' && !inQuote) {
      if (cur.trim()) lines.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function parseTextToQuestions(text: string): ImportStats {
  const lines = splitCsvLines(text);
  const header = lines[0]?.toLowerCase();
  const parsed: ParsedQuestion[] = [];

  if (!header?.startsWith('tema;')) {
    return { total: 0, valid: 0, invalid: 0, temas: {}, facil: 0, medio: 0, dificil: 0, parsed: [] };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) {
      parsed.push({ tema:'', enunciado:'', oa:'', ob:'', oc:'', od:'', resp:'', diff:'', ref:'', valid: false, error: `Linha ${i+1}: colunas insuficientes (${cols.length})` });
      continue;
    }
    const [tema, enunciado, oa, ob, oc, od, resp, diff, ref = ''] = cols.map(c => c.trim());
    if (!['a','b','c','d'].includes(resp)) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: resposta_correta inválida ("${resp}")` });
      continue;
    }
    if (!tema || !enunciado) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: tema ou enunciado em branco` });
      continue;
    }
    if (!ref) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: referência em branco (obrigatório)` });
      continue;
    }

    // Validação de limites de caracteres baseada nas perguntas originais (com margem de segurança)
    if (tema.length > 40) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: tema excedeu 40 caracteres (tem ${tema.length})` });
      continue;
    }
    if (enunciado.length > 250) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: enunciado excedeu 250 caracteres (tem ${enunciado.length})` });
      continue;
    }
    if (oa.length > 100 || ob.length > 100 || oc.length > 100 || od.length > 100) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: uma das opções de resposta excedeu 100 caracteres` });
      continue;
    }
    if (ref.length > 500) {
      parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: false, error: `Linha ${i+1}: referência excedeu 500 caracteres (tem ${ref.length})` });
      continue;
    }

    parsed.push({ tema, enunciado, oa, ob, oc, od, resp, diff, ref, valid: true });
  }

  const temas: Record<string, number> = {};
  let facil = 0, medio = 0, dificil = 0;
  for (const p of parsed.filter(p => p.valid)) {
    temas[p.tema] = (temas[p.tema] || 0) + 1;
    const nd = p.diff.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nd.includes('facil')) facil++;
    else if (nd.includes('medio')) medio++;
    else dificil++;
  }

  return { total: parsed.length, valid: parsed.filter(p=>p.valid).length, invalid: parsed.filter(p=>!p.valid).length, temas, facil, medio, dificil, parsed };
}

/* ─── Modal de Importação de Perguntas ───────────────────── */
interface ImportModalProps {
  themes: Theme[];
  session: any;
  isAdmin: boolean;
  onClose: () => void;
  onDone: (report: string) => void;
}
function ImportQuestionsModal({ themes, session, isAdmin, onClose, onDone }: ImportModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'ignore' | 'replace'>('ignore');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      setPastedText(text);
      e.target.value = '';
    } catch (err) {
      alert('Erro ao ler arquivo');
    }
  };

  const handlePasteAnalyze = async () => {
    if (!supabase) return;
    setAnalyzing(true);
    const newStats = parseTextToQuestions(pastedText);

    try {
      const allData = await fetchAllPages((from, to) =>
        supabase!.from('questions').select('id, statement').range(from, to)
      );

      if (allData.length > 0) {
        const existingMap = new Map<string, string>();
        allData.forEach((q: any) => existingMap.set(q.statement.trim().toLowerCase(), q.id));
        
        let dbDupes = 0;
        newStats.parsed.forEach(p => {
          if (p.valid) {
            const stmtTrim = p.enunciado.trim().toLowerCase();
            if (existingMap.has(stmtTrim)) {
              p.existingId = existingMap.get(stmtTrim);
              dbDupes++;
            }
          }
        });
        newStats.dbDuplicatesCount = dbDupes;
      }
    } catch (err) {
      console.error('Erro ao verificar duplicatas', err);
    }
    
    setStats(newStats);
    setAnalyzing(false);
  };

  const handleConfirmImport = async () => {
    if (!stats || !supabase) return;
    setImporting(true);
    let imported = 0, skipped = 0, updated = 0;
    const errors: string[] = [];
    const localThemes = [...themes];
    let dupesInFile = 0;
    let dupesInDb = 0;

    const processedInImport = new Set<string>();

    for (const p of stats.parsed) {
      if (!p.valid) { skipped++; if (p.error) errors.push(p.error); continue; }

      const stmtTrim = p.enunciado.trim().toLowerCase();

      // 1. Verifica se está duplicado no próprio arquivo/lista atual
      if (processedInImport.has(stmtTrim)) {
        skipped++;
        dupesInFile++;
        continue;
      }
      processedInImport.add(stmtTrim);

      // 2. Verifica se já está no banco de dados e aplica ação do usuário
      if (p.existingId) {
        dupesInDb++;
        if (duplicateAction === 'ignore') {
          skipped++;
          continue;
        }
      }

      const normDiff = p.diff.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const finalDiff = normDiff.includes('facil') ? 'facil' : normDiff.includes('medio') ? 'medio' : 'dificil';

      let themeId: string | undefined;
      const cached = localThemes.find(t => t.name.toLowerCase() === p.tema.toLowerCase());
      if (cached) {
        themeId = cached.id;
      } else {
        const { data: dbTheme } = await supabase.from('themes').select('id, name').ilike('name', p.tema).maybeSingle();
        if (dbTheme) {
          themeId = dbTheme.id;
          localThemes.push(dbTheme as Theme);
        } else {
          const { data: newT, error: tErr } = await supabase.from('themes').insert({ name: p.tema, created_by: session.player_id }).select('id, name').single();
          if (tErr || !newT) { errors.push(`Erro ao criar tema "${p.tema}"`); skipped++; continue; }
          themeId = newT.id;
          localThemes.push(newT as Theme);
        }
      }

      const qData = {
        theme_id: themeId,
        statement: p.enunciado,
        option_a: p.oa, option_b: p.ob, option_c: p.oc, option_d: p.od,
        correct_answer: p.resp,
        difficulty: finalDiff,
        reference: p.ref || '',
        status: isAdmin ? 'aprovada' : 'pendente',
        is_native: isAdmin,
        created_by: session.player_id,
      };

      if (p.existingId && duplicateAction === 'replace') {
        const { error: upErr } = await supabase.from('questions').update(qData).eq('id', p.existingId);
        if (upErr) { errors.push(`Erro ao atualizar: ${p.enunciado}`); skipped++; }
        else updated++;
      } else {
        const { error: insErr } = await supabase.from('questions').insert({ ...qData, images: [] });
        if (insErr) { errors.push(`Erro ao inserir: ${p.enunciado}`); skipped++; }
        else imported++;
      }
    }

    setImporting(false);
    const report = [
      `✅ ${imported} pergunta(s) importada(s)`,
      ...(updated > 0 ? [`🔄 ${updated} atualizada(s)`] : []),
      `⚠️ ${skipped} ignorada(s) (totais)`
    ];
    if (dupesInDb > 0) report.push(`🚫 ${dupesInDb} encontradas no banco`);
    if (dupesInFile > 0) report.push(`📎 ${dupesInFile} duplicadas no arquivo`);
    if (errors.length) report.push('\nDetalhes de erros:', ...errors.slice(0, 10));
    onDone(report.join('\n'));
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={onClose}>
      <div className="modal-box modal-large" style={{ maxHeight: '90dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">📥 Importar Perguntas</h3>

        {!stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ opacity: 0.85, fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
              Cole o CSV ou <strong>carregue um arquivo</strong>. Todos os 9 campos são <strong>obrigatórios</strong> (incluindo referência).<br/>
              <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>Limites: Tema(40), Enunc(250), Opções(100), Ref(500)</span>
            </p>

            <button className="btn-secondary" style={{ width: '80%', margin: '0 auto', display: 'block', padding: '0.5rem', fontSize: '0.9rem' }} onClick={() => fileInputRef.current?.click()}>
              📂 Carregar arquivo CSV{fileName ? `: ${fileName}` : ''}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv,.txt" style={{ display: 'none' }} onChange={handleFileChange} />

            <textarea
              className="form-input"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '0.78rem', resize: 'vertical' }}
              placeholder={`tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia\nBíblia;Quem escreveu o Gênesis?;Moisés;Davi;Salomão;Paulo;a;facil;"Gênesis 1:1..."`}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
            />
            <button className="btn-primary" style={{ width: '80%', margin: '0 auto', display: 'block' }} disabled={!pastedText.trim() || analyzing} onClick={handlePasteAnalyze}>
              {analyzing ? '⏳ Analisando...' : '🔍 Analisar texto'}
            </button>
          </div>
        )}

        {/* Estatísticas e prévia */}
        {stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1 }}>
            {stats.total === 0 ? (
              <p style={{ color: '#f87171', textAlign: 'center' }}>❌ Cabeçalho inválido ou texto vazio. Verifique as instruções.</p>
            ) : (
              <>
                {/* Cards de estatísticas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { label: 'Total', val: stats.total, color: '#fff' },
                    { label: '✅ Válidas', val: stats.valid, color: '#4ade80' },
                    { label: '❌ Inválidas', val: stats.invalid, color: '#f87171' },
                    { label: '🟢 Fácil', val: stats.facil, color: '#86efac' },
                    { label: '🟡 Médio', val: stats.medio, color: '#fde047' },
                    { label: '🔴 Difícil', val: stats.dificil, color: '#fca5a5' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.75 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Temas */}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.3rem' }}>🏷️ {Object.keys(stats.temas).length} tema(s) novo(s) detectado(s):</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {Object.entries(stats.temas).map(([tema, count]) => (
                      <span key={tema} style={{ background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.75rem' }}>
                        {tema} ({count})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Duplicadas no banco - Ação */}
                {!!stats.dbDuplicatesCount && stats.dbDuplicatesCount > 0 ? (
                  <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '0.8rem', marginTop: '0.2rem' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#fca5a5' }}>
                      ⚠️ Foram encontradas {stats.dbDuplicatesCount} pergunta(s) que já existem no banco. O que deseja fazer com elas?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="duplicateAction" 
                          checked={duplicateAction === 'ignore'} 
                          onChange={() => setDuplicateAction('ignore')} 
                        />
                        Ignorar (manter a pergunta antiga no banco)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="duplicateAction" 
                          checked={duplicateAction === 'replace'} 
                          onChange={() => setDuplicateAction('replace')} 
                        />
                        Substituir (atualizar o banco com os novos dados desta importação)
                      </label>
                    </div>
                  </div>
                ) : null}

                {/* Prévia em tabela */}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.4rem' }}>📋 Prévia das perguntas:</p>
                  <div style={{ overflowY: 'auto', maxHeight: '220px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                      <thead style={{ background: 'rgba(30,10,50,0.97)', position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>#</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>Tema</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>Enunciado</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>Resp</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>Dif</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.parsed.map((p, i) => (
                          <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: p.valid ? 'transparent' : 'rgba(248,113,113,0.1)' }}>
                            <td style={{ padding: '3px 6px', opacity: 0.6 }}>{i + 1}</td>
                            <td style={{ padding: '3px 6px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tema}</td>
                            <td style={{ padding: '3px 6px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.enunciado}>{p.enunciado || <em style={{opacity:0.5}}>vazio</em>}</td>
                            <td style={{ padding: '3px 6px', fontWeight: 700, color: '#4ade80' }}>{p.resp.toUpperCase()}</td>
                            <td style={{ padding: '3px 6px', opacity: 0.8 }}>{p.diff?.slice(0,3)}</td>
                            <td style={{ padding: '3px 6px' }}>
                              {p.valid
                                ? <span style={{ color: '#4ade80' }}>✓</span>
                                : <span style={{ color: '#f87171' }} title={p.error}>✗</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Erros de validação */}
                {stats.invalid > 0 && (
                  <p style={{ color: '#f87171', fontSize: '0.78rem' }}>
                    ⚠️ {stats.invalid} linha(s) inválida(s) serão ignoradas na importação.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Rodapé */}
        <div className="modal-actions" style={{ marginTop: !stats ? '0' : '1rem', flexShrink: 0 }}>
          {stats && stats.valid > 0 && (
            <button
              className="btn-primary"
              style={{ flex: 2, background: '#22c55e' }}
              onClick={handleConfirmImport}
              disabled={importing}
            >
              {importing ? '⏳ Importando...' : `✅ Confirmar importação (${stats.valid} perguntas)`}
            </button>
          )}
          {stats && (
            <button className="btn-secondary" onClick={() => setStats(null)} disabled={importing}>
              ← Voltar
            </button>
          )}
          <button 
            className="btn-secondary" 
            onClick={onClose} 
            disabled={importing}
            style={!stats ? { width: '80%', margin: '0 auto' } : {}}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Formulário de pergunta ──────────────────────────────── */
interface QuestionFormProps {
  question?: Question | null;
  themes: Theme[];
  onSave: () => void;
  onCancel: () => void;
  isAdmin: boolean;
  playerId: string;
  adminInitials?: string;
}
function QuestionForm({ question, themes, onSave, onCancel, isAdmin, playerId, adminInitials }: QuestionFormProps) {
  const [themeId, setThemeId] = useState(question?.theme_id ?? '');
  const [newTheme, setNewTheme] = useState('');
  const [newThemePrivate, setNewThemePrivate] = useState(false);
  const [statement, setStatement] = useState(question?.statement ?? '');
  const [optA, setOptA] = useState(question?.option_a ?? '');
  const [optB, setOptB] = useState(question?.option_b ?? '');
  const [optC, setOptC] = useState(question?.option_c ?? '');
  const [optD, setOptD] = useState(question?.option_d ?? '');
  const [correct, setCorrect] = useState<string>(question?.correct_answer ?? 'a');
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? 'medio');
  const [reference, setReference] = useState(question?.reference ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(question?.images ?? []);
  const [reviewed, setReviewed] = useState<boolean>((question as any)?.reviewed ?? false);
  const [makeNative, setMakeNative] = useState<boolean>(question ? !!question.is_native : isAdmin);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false); // guard contra double-submit

  const handlePasteImage = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        for (const type of imageTypes) {
          const blob = await item.getType(type);
          const file = new File([blob], `pasted-${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
          setImageFiles(prev => [...prev, file]);
          return;
        }
      }
      alert('Nenhuma imagem encontrada na área de transferência.');
    } catch (err) {
      console.error('Erro ao colar imagem:', err);
      alert('Não foi possível ler a área de transferência. Verifique as permissões do navegador ou se o site tem permissão para ler a área de transferência.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return; // bloqueia double-submit
    submittingRef.current = true;
    setError('');

    // ── Validação completa de todos os campos obrigatórios ──
    const missingFields: string[] = [];
    if (!themeId && !newTheme.trim())             missingFields.push('Tema');
    if (themeId === '__new__' && !newTheme.trim()) missingFields.push('Nome do novo tema');
    if (!statement.trim())                        missingFields.push('Enunciado');
    if (!optA.trim())                             missingFields.push('Opção A');
    if (!optB.trim())                             missingFields.push('Opção B');
    if (!optC.trim())                             missingFields.push('Opção C');
    if (!optD.trim())                             missingFields.push('Opção D');
    if (!reference.trim())                        missingFields.push('Fonte / Referência');

    if (missingFields.length > 0) {
      submittingRef.current = false;
      return setError(`Preencha os campos obrigatórios: ${missingFields.join(', ')}.`);
    }

    // ── Validação de limites de caracteres ──
    const limitErrors: string[] = [];
    if (newTheme.trim().length > 40)    limitErrors.push('Novo tema (máx. 40 caracteres)');
    if (statement.trim().length > 250)  limitErrors.push('Enunciado (máx. 250 caracteres)');
    if (optA.trim().length > 100)       limitErrors.push('Opção A (máx. 100 caracteres)');
    if (optB.trim().length > 100)       limitErrors.push('Opção B (máx. 100 caracteres)');
    if (optC.trim().length > 100)       limitErrors.push('Opção C (máx. 100 caracteres)');
    if (optD.trim().length > 100)       limitErrors.push('Opção D (máx. 100 caracteres)');
    if (reference.trim().length > 500)  limitErrors.push('Referência (máx. 500 caracteres)');

    if (limitErrors.length > 0) {
      submittingRef.current = false;
      return setError(`Limite de caracteres excedido: ${limitErrors.join('; ')}.`);
    }

    if (!supabase) { submittingRef.current = false; return; }

    let resolvedThemeId = themeId;

    // Criar novo tema se necessário
    if (themeId === '__new__' && newTheme.trim()) {
      const { data: t, error: tErr } = await supabase
        .from('themes')
        .insert({ name: newTheme.trim(), created_by: playerId, is_private: newThemePrivate })
        .select('id')
        .single();
      if (tErr) { submittingRef.current = false; return setError('Erro ao criar tema'); }
      resolvedThemeId = t.id;
    }
    if (!resolvedThemeId || resolvedThemeId === '__new__') { submittingRef.current = false; return setError('Selecione ou crie um tema'); }

    setLoading(true);

    // Upload de imagens
    const uploadedUrls: string[] = [...existingImages];
    for (const file of imageFiles) {
      const path = `${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('question-images').upload(path, file);
      if (!upErr) {
        const { data: pubData } = supabase.storage.from('question-images').getPublicUrl(path);
        uploadedUrls.push(pubData.publicUrl);
      }
    }

    const payload = {
      theme_id: resolvedThemeId,
      statement: statement.trim(),
      option_a: optA.trim(),
      option_b: optB.trim(),
      option_c: optC.trim(),
      option_d: optD.trim(),
      correct_answer: correct,
      difficulty,
      reference: reference.trim(),
      images: uploadedUrls,
      is_native: isAdmin ? makeNative : false,
      created_by: isAdmin ? (makeNative ? playerId : (question?.created_by || playerId)) : playerId,
      // Controle de revisão (apenas admin pode marcar)
      reviewed: isAdmin ? reviewed : undefined,
      reviewed_by: isAdmin ? (reviewed ? playerId : null) : undefined,
      reviewed_at: isAdmin ? (reviewed ? new Date().toISOString() : null) : undefined,
    };

    const saveToSupabase = async (retries = 1): Promise<{ error: any }> => {
      try {
        if (question?.id) {
          // Não-admins que editam uma pergunta já aprovada precisam de reaprovação
          const updatePayload = isAdmin
            ? payload
            : { ...payload, status: 'pendente' };
          return await supabase!.from('questions').update(updatePayload).eq('id', question.id);
        } else {
          return await supabase!.from('questions').insert({ ...payload, status: 'pendente' });
        }
      } catch (err: any) {
        if (retries > 0 && err?.message?.includes('Load failed')) {
          console.warn('Tentando novamente após Load failed...');
          return saveToSupabase(retries - 1);
        }
        return { error: err };
      }
    };

    let { error: dbErr } = await saveToSupabase(1);

    // Tratamento específico se supabase retornar o erro mas não lançar exceção
    if (dbErr && dbErr.message === 'Load failed') {
      console.warn('Tentando novamente (via dbErr) após Load failed...');
      const retryResult = await saveToSupabase(0);
      dbErr = retryResult.error;
    }

    if (dbErr) {
      setLoading(false);
      submittingRef.current = false;
      return setError(question?.id ? 'Erro ao atualizar: ' + dbErr.message : 'Erro ao criar: ' + dbErr.message);
    }

    setLoading(false);
    submittingRef.current = false;
    onSave();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box modal-large">
        <h3 className="modal-title">
          {question ? 'Editar pergunta' : 'Nova pergunta'}
          {question?.question_number && <span style={{fontSize: '0.8rem', marginLeft: '10px', color: 'var(--muted)'}}>#{question.question_number}</span>}
        </h3>
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Tema */}
          <div className="form-group">
            <label className="form-label">Tema</label>
            <select className="form-input" value={themeId} onChange={e => { setThemeId(e.target.value); setNewTheme(''); }} required={!newTheme}>
              <option value="">— Selecione —</option>
              {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="__new__">➕ Novo tema...</option>
            </select>
            {themeId === '__new__' && (
              <div style={{ position: 'relative' }}>
                <input className="form-input" style={{ marginTop: 6 }} placeholder="Nome do novo tema" value={newTheme} onChange={e => setNewTheme(e.target.value)} required maxLength={40} />
                <span style={{ display: 'block', textAlign: 'right', fontSize: '0.72rem', marginTop: '2px', color: newTheme.length >= 38 ? '#ef4444' : newTheme.length >= 30 ? '#f5c842' : 'rgba(255,255,255,0.35)' }}>
                  {newTheme.length}/40
                </span>
                
                {/* Checkbox de Tema Privado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <label style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#fff' }}>
                    <input type="checkbox" checked={newThemePrivate} onChange={e => setNewThemePrivate(e.target.checked)} style={{ accentColor: '#f5c842', cursor: 'pointer', width: '16px', height: '16px' }} />
                    🔒 Tema privado / exclusivo
                  </label>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px', marginLeft: '24px', lineHeight: '1.3' }}>
                  Temas privados só aparecem para você e administradores nas telas de seleção de temas e administração.
                </p>
              </div>
            )}
          </div>

          {/* Enunciado */}
          <div className="form-group">
            <label className="form-label">Enunciado</label>
            <textarea className="form-input" rows={8} value={statement} onChange={e => setStatement(e.target.value)} required maxLength={250} style={{ resize: 'vertical', fontWeight: 'normal', fontSize: '0.9rem', lineHeight: '1.4', caretColor: '#f5c842', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <span style={{ display: 'block', textAlign: 'right', fontSize: '0.72rem', marginTop: '2px', color: statement.length >= 240 ? '#ef4444' : statement.length >= 200 ? '#f5c842' : 'rgba(255,255,255,0.35)' }}>
              {statement.length}/250 caracteres
            </span>
          </div>

          {/* Fonte / Referência */}
          <div className="form-group">
            <label className="form-label">Fonte / Referência</label>
            <textarea className="form-input" rows={6} value={reference} onChange={e => setReference(e.target.value)} required placeholder="Ex: Maior Homem cap. 116" maxLength={500} style={{ resize: 'vertical', fontWeight: 'normal', fontSize: '0.85rem', lineHeight: '1.4', caretColor: '#f5c842', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <span style={{ display: 'block', textAlign: 'right', fontSize: '0.72rem', marginTop: '2px', color: reference.length >= 480 ? '#ef4444' : reference.length >= 400 ? '#f5c842' : 'rgba(255,255,255,0.35)' }}>
              {reference.length}/500 caracteres
            </span>
          </div>

          {/* Opções */}
          {(['a', 'b', 'c', 'd'] as const).map(letter => {
            const val = letter === 'a' ? optA : letter === 'b' ? optB : letter === 'c' ? optC : optD;
            const setVal = letter === 'a' ? setOptA : letter === 'b' ? setOptB : letter === 'c' ? setOptC : setOptD;
            return (
              <div key={letter} className="form-group option-row">
                <label className="form-label">
                  <input type="radio" name="correct" value={letter} checked={correct === letter} onChange={() => setCorrect(letter)} style={{ accentColor: '#f5c842' }} />
                  {' '}Opção {letter.toUpperCase()} {correct === letter && <span className="correct-badge">✓ Correta</span>}
                </label>
                <textarea 
                  className="form-input" 
                  rows={3}
                  style={{ resize: 'vertical', fontWeight: 'normal', fontSize: '0.82rem', lineHeight: '1.3', caretColor: '#f5c842', backgroundColor: 'rgba(255,255,255,0.06)' }}
                  value={val}
                  onChange={e => setVal(e.target.value)}
                  required 
                  maxLength={100}
                  placeholder={`Opção ${letter.toUpperCase()}`} 
                />
                <span style={{ display: 'block', textAlign: 'right', fontSize: '0.72rem', marginTop: '2px', color: val.length >= 95 ? '#ef4444' : val.length >= 80 ? '#f5c842' : 'rgba(255,255,255,0.35)' }}>
                  {val.length}/100
                </span>
              </div>
            );
          })}

          {/* Dificuldade */}
          <div className="form-group">
            <label className="form-label">Dificuldade</label>
            <div className="radio-group">
              {DIFFICULTIES.map(d => (
                <label key={d} className={`radio-chip ${difficulty === d ? 'active' : ''}`}>
                  <input type="radio" name="difficulty" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} />
                  {DIFF_LABEL[d]}
                </label>
              ))}
            </div>
          </div>

          {/* Imagens */}
          <div className="form-group">
            <label className="form-label">Imagens (opcional)</label>
            <div className="image-upload-zone">
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                multiple 
                style={{ display: 'none' }}
                onChange={e => setImageFiles(Array.from(e.target.files ?? []))} 
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button 
                  type="button" 
                  className="btn-action-outline" 
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  🖼️ {imageFiles.length > 0 ? `${imageFiles.length} arq(s)` : 'Procurar'}
                </button>
                <button 
                  type="button" 
                  className="btn-action-outline" 
                  style={{ flex: 1, padding: '10px' }}
                  onClick={handlePasteImage}
                >
                  📋 Colar Imagem
                </button>
              </div>
              
              {existingImages.length > 0 && (
                <div className="image-preview-row">
                  {existingImages.map((url, i) => (
                    <div key={i} className="image-thumb-wrap">
                      <img src={url} alt="" className="image-thumb" />
                      <button type="button" className="image-remove-btn" onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              
              {imageFiles.length > 0 && (
                <div className="image-preview-row" style={{ opacity: 0.9 }}>
                  {imageFiles.map((file, i) => (
                    <div key={i} className="image-thumb-wrap">
                      <img src={URL.createObjectURL(file)} alt="" className="image-thumb" />
                      <button type="button" className="image-remove-btn" onClick={() => setImageFiles(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="form-hint">Formatos: JPEG, PNG, WebP. O limite depende do Supabase Storage.</span>
          </div>

          {/* Revisão (admin) */}
          {isAdmin && question?.id && (
            <div className="form-group" style={{ background: reviewed ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${reviewed ? '#2ecc71' : 'rgba(255,255,255,0.15)'}`, borderRadius: '10px', padding: '0.75rem 1rem', transition: 'all 0.2s' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={e => setReviewed(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#2ecc71', cursor: 'pointer', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: reviewed ? '#2ecc71' : '#fff', fontSize: '0.95rem' }}>
                    {reviewed ? '✅ Pergunta Revisada' : '🔲 Marcar como Revisada'}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '2px' }}>
                    {reviewed ? 'Esta pergunta foi verificada e aprovada pelo administrador.' : 'Marque após revisar o conteúdo, referência e alternativas.'}
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Identificação / Autoria */}
          {isAdmin && (
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.75rem 1rem', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={makeNative}
                  onChange={e => setMakeNative(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#3498db', cursor: 'pointer', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                    Tornar Pergunta Nativa
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '2px' }}>
                    {makeNative 
                      ? `A autoria será registrada como Nativa — ${adminInitials ?? 'ADM'}`
                      : `Manter a autoria original${question?.creator?.nickname ? ` (${question.creator.nickname})` : ''}.`}
                  </div>
                </div>
              </label>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : question ? 'Salvar alterações' : 'Criar pergunta'}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Página principal de perguntas ──────────────────────── */
export default function Questions() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<(Question & { theme_name?: string; creator_nickname?: string; answered?: boolean; reviewed?: boolean })[]>([]);
  const [allQsStats, setAllQsStats] = useState<{ id: string; theme_id: string; status: string; reviewed: boolean; created_by?: string; created_at?: string; is_native?: boolean; creator?: { nickname: string } }[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterThemes, setFilterThemes] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDiff, setFilterDiff] = useState('');
  const [filterImage, setFilterImage] = useState(''); // '', 'with', 'without'
  const [filterAnswered, setFilterAnswered] = useState(''); // '', 'answered', 'not_answered'
  const [filterReviewed, setFilterReviewed] = useState(''); // '', 'reviewed', 'not_reviewed'
  const [filterReviewReq, setFilterReviewReq] = useState(''); // '', 'with_review_req'
  const [filterUserCreated, setFilterUserCreated] = useState(false); // admin: filtrar apenas criadas por usuários
  const [reviewRequests, setReviewRequests] = useState<Record<string, { player_name: string; created_at: string; message?: string }[]>>({});
  const [filterText, setFilterText] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showThemesModal, setShowThemesModal] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [showCsvInstructions, setShowCsvInstructions] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvReport, setCsvReport] = useState<string>('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [aiImportPrompt, setAiImportPrompt] = useState<string>('');

  /* ── Estados da Auditoria ── */
  const [activeTab, setActiveTab] = useState<'banco' | 'auditoria'>('banco');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [sortField, setSortField] = useState('answered_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    // Busca todas as perguntas com paginação para contornar o limite de 1000
    const qs = await fetchAllPages((from, to) => {
      let q = supabase!.from('questions').select('*, theme:themes(id,name), creator:players!questions_created_by_fkey(nickname)').order('created_at', { ascending: false }).range(from, to);
      if (!isAdmin) q = q.eq('created_by', session!.player_id);
      return q;
    });
    
    const tReq = await supabase.from('themes').select('*, creator:players!themes_created_by_fkey(nickname)').order('name');
    let th = tReq.data;
    if (tReq.error) {
      console.error('Erro fetching themes with join:', tReq.error);
      const fallback = await supabase.from('themes').select('*').order('name');
      th = fallback.data;
    }
    
    if (th) {
      th = th.filter(t => !t.is_private || isAdmin || t.created_by === session!.player_id);
    }

    const [ans, allQs] = await Promise.all([
      fetchAllPages((from, to) =>
        supabase!.from('answered_questions').select('question_id').eq('player_id', session!.player_id).range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase!.from('questions').select('id, theme_id, status, reviewed, created_by, created_at, is_native, creator:players!questions_created_by_fkey(nickname)').range(from, to)
      )
    ]);

    // Busca solicitações de revisão separadamente (admin only)
    const rrMap: Record<string, { player_name: string; created_at: string; message?: string }[]> = {};
    if (isAdmin) {
      const { data: rrData, error: rrError } = await supabase
        .from('question_review_requests')
        .select('question_id, message, created_at, player_id')
        .eq('resolved', false)   // apenas não resolvidas
        .order('created_at', { ascending: false });

      console.log('[ReviewRequests] isAdmin:', isAdmin, '| rows:', rrData?.length, '| error:', rrError);

      if (rrError) {
        console.error('Erro ao buscar revisões:', rrError);
      } else if (rrData && rrData.length > 0) {
        // Busca nicknames dos jogadores
        const playerIds = [...new Set(rrData.map((r: any) => r.player_id))];
        const { data: playersData } = await supabase
          .from('players')
          .select('id, nickname')
          .in('id', playerIds);
        const playerNickMap: Record<string, string> = {};
        for (const p of (playersData ?? []) as any[]) {
          playerNickMap[p.id] = p.nickname;
        }

        for (const rr of rrData as any[]) {
          if (!rrMap[rr.question_id]) rrMap[rr.question_id] = [];
          rrMap[rr.question_id].push({
            player_name: playerNickMap[rr.player_id] ?? 'Desconhecido',
            created_at: rr.created_at,
            message: rr.message,
          });
        }
      }
    }
    setReviewRequests(rrMap);

    const answSet = new Set((ans ?? []).map((a: any) => a.question_id));
    setAnsweredIds(answSet);
    setAllQsStats((allQs as any[]) ?? []);
    setThemes((th as Theme[]) ?? []);
    setQuestions(
      ((qs as any[]) ?? []).map(q => ({
        ...q,
        theme_id: q.theme?.id,
        images: q.images ?? [],
        theme_name: q.theme?.name ?? '—',
        creator_nickname: q.creator?.nickname ?? '—',
        answered: answSet.has(q.id),
        reviewed: q.reviewed ?? false,
      }))
    );
    
    // Fetch custom AI prompt from global defaults settings
    try {
      const { data: configData } = await supabase
        .from('game_settings')
        .select('ai_import_prompt')
        .eq('player_id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle();
      if (configData?.ai_import_prompt) {
        setAiImportPrompt(configData.ai_import_prompt);
      } else {
        setAiImportPrompt('');
      }
    } catch (err) {
      console.error('Erro ao buscar prompt da IA:', err);
    }

    setLoading(false);
  }, [session, isAdmin]);

  const loadAudit = useCallback(async () => {
    if (!isAdmin || !supabase) return;
    setLoadingAudit(true);
    const { data } = await supabase
      .from('question_audit')
      .select(`
        id, session_number, answered_at, time_spent, is_correct, selected_option, helps_used, theme_cycle,
        player:players(nickname),
        question:questions(id, statement, question_number, theme:themes(name))
      `)
      .order('answered_at', { ascending: false })
      .limit(1000);
      
    if (data) {
      setAuditLogs(data.map(item => ({
        ...item,
        player_name: (item.player as any)?.nickname ?? 'Desconhecido',
        theme_name: (item.question as any)?.theme?.name ?? '—',
        statement: (item.question as any)?.statement ?? '—',
        question_num: (item.question as any)?.question_number ?? '—'
      })));
    }
    setLoadingAudit(false);
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === 'auditoria') {
      loadAudit();
    }
  }, [activeTab, loadAudit]);

  const handleSortAudit = (field: string) => {
    const isAsc = sortField === field && sortDir === 'asc';
    setSortDir(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  const sortedAudit = [...auditLogs].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  /* Filtros */
  const filtered = questions.filter(q => {
    const search = filterText.toLowerCase();
    const matchText = !search ||
      (q.question_number?.toString().includes(search)) ||
      (q.statement.toLowerCase().includes(search)) ||
      (q.option_a.toLowerCase().includes(search)) ||
      (q.option_b.toLowerCase().includes(search)) ||
      (q.option_c.toLowerCase().includes(search)) ||
      (q.option_d.toLowerCase().includes(search)) ||
      (q.reference?.toLowerCase().includes(search));

    return (isAdmin || q.created_by === session!.player_id) &&
      (filterThemes.length === 0 || filterThemes.includes(q.theme_id!)) &&
      (!filterStatus || q.status === filterStatus) &&
      (!filterDiff || q.difficulty === filterDiff) &&
      (!filterImage || (filterImage === 'with' ? q.images?.length > 0 : q.images?.length === 0)) &&
      (!filterAnswered || (filterAnswered === 'answered' ? q.answered : !q.answered)) &&
      (!filterReviewed || (filterReviewed === 'reviewed' ? q.reviewed : !q.reviewed)) &&
      (!filterReviewReq || (filterReviewReq === 'with_review_req' ? !!reviewRequests[q.id]?.length : true)) &&
      (!filterUserCreated || (!q.is_native && !!q.created_by)) &&
      matchText;
  });

  /* Delete */
  const handleDelete = async (q: Question) => {
    if (!supabase) return;
    const canDelete = isAdmin || (q.status === 'pendente' && q.created_by === session!.player_id);
    if (!canDelete) return;
    if (!confirm(`Apagar a pergunta "${q.statement.slice(0, 60)}..."?`)) return;
    await supabase.from('questions').delete().eq('id', q.id);
    load();
  };

  const handleStatus = async (id: string, status: 'aprovada' | 'rejeitada' | 'inativa') => {
    await supabase!.from('questions').update({ status, approved_by: session!.player_id, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  /* Resolver (dispensar) solicitações de revisão de uma pergunta */
  const handleResolveReviewRequests = async (questionId: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('question_review_requests')
      .update({ resolved: true })
      .eq('question_id', questionId);
    if (error) {
      console.error('Erro ao resolver solicitação:', error);
      alert('Erro ao resolver: ' + error.message);
      return;
    }
    // Atualiza o estado local imediatamente sem recarregar tudo
    setReviewRequests(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const handleResetAnswered = async (themeId: string) => {
    if (!supabase) return;
    const ids = allQsStats.filter(q => q.theme_id === themeId && answeredIds.has(q.id)).map(q => q.id);
    if (!ids.length) return;

    const { data: cycleData } = await supabase
      .from('theme_cycles')
      .select('cycle')
      .eq('player_id', session!.player_id)
      .eq('theme_id', themeId)
      .maybeSingle();
      
    const newCycle = (cycleData?.cycle || 1) + 1;
    await supabase.from('theme_cycles').upsert({
      player_id: session!.player_id,
      theme_id: themeId,
      cycle: newCycle,
      reset_at: new Date().toISOString()
    });

    await supabase.from('answered_questions').delete().eq('player_id', session!.player_id).in('question_id', ids);
    load();
  };

  const handleResetAll = async () => {
    if (!supabase || !session) return;
    if (!confirm('Deseja realmente reiniciar o seu progresso em TODAS as perguntas de TODOS os temas?')) return;
    
    setLoading(true);

    const themesWithAnswers = new Set<string>();
    allQsStats.forEach(q => {
      if (q.theme_id && answeredIds.has(q.id)) {
        themesWithAnswers.add(q.theme_id);
      }
    });

    for (const themeId of themesWithAnswers) {
      const { data: cycleData } = await supabase
        .from('theme_cycles')
        .select('cycle')
        .eq('player_id', session.player_id)
        .eq('theme_id', themeId)
        .maybeSingle();
        
      const newCycle = (cycleData?.cycle || 1) + 1;
      await supabase.from('theme_cycles').upsert({
        player_id: session.player_id,
        theme_id: themeId,
        cycle: newCycle,
        reset_at: new Date().toISOString()
      });
    }

    const { error } = await supabase
      .from('answered_questions')
      .delete()
      .eq('player_id', session.player_id);
    
    if (error) alert('Erro ao reiniciar: ' + error.message);
    else {
      alert('Progresso reiniciado com sucesso!');
      load();
    }
    setLoading(false);
  };


  /* Export CSV */
  const handleCsvExport = (themeId?: string) => {
    const exportQs = questions.filter(q => {
      const matchTheme = !themeId || q.theme_id === themeId;
      const matchStatus = isAdmin ? (q.status === 'aprovada') : true;
      return matchTheme && matchStatus;
    });

    const rows = [
      'tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia',
      ...exportQs.map(q => [
        q.theme_name ?? q.theme?.name ?? '',
        q.statement,
        q.option_a, q.option_b, q.option_c, q.option_d,
        q.correct_answer,
        q.difficulty,
        q.reference ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const count = exportQs.length;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = themeId 
      ? `funplayb_tema_${themes.find(t => t.id === themeId)?.name || 'extra'}_${count}_perguntas_${dateStr}.csv`
      : isAdmin 
        ? `funplayb_todas_${count}_perguntas_${dateStr}.csv`
        : `funplayb_minhas_${count}_perguntas_${dateStr}.csv`;

    const blob = new Blob(['\ufeff' + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  };

  /* Export Texto (copia para área de transferência) — apenas por tema */
  const [copySuccess, setCopySuccess] = useState('');
  const handleTextExport = async (themeId: string) => {
    const themeName = themes.find(t => t.id === themeId)?.name || 'Tema';
    const exportQs = questions.filter(q => {
      const matchTheme = q.theme_id === themeId;
      const matchStatus = isAdmin ? (q.status === 'aprovada') : true;
      return matchTheme && matchStatus;
    });

    if (exportQs.length === 0) {
      alert('Nenhuma pergunta encontrada para este tema.');
      return;
    }

    const header = 'tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia';
    const lines = exportQs.map(q => [
      q.theme_name ?? q.theme?.name ?? '',
      q.statement,
      q.option_a, q.option_b, q.option_c, q.option_d,
      q.correct_answer,
      q.difficulty,
      q.reference ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

    const text = [header, ...lines].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(`✅ ${exportQs.length} perguntas do tema "${themeName}" copiadas para a área de transferência!`);
      setTimeout(() => setCopySuccess(''), 4000);
    } catch {
      // Fallback para browsers que não suportam clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopySuccess(`✅ ${exportQs.length} perguntas do tema "${themeName}" copiadas!`);
      setTimeout(() => setCopySuccess(''), 4000);
    }
  };

  /* Resumo por tema */
  const themeSummary = themes.map(t => {
    const qInTheme = allQsStats.filter(q => q.theme_id === t.id);
    const approved = qInTheme.filter(q => q.status === 'aprovada');
    const total = approved.length;
    const available = approved.filter(q => !answeredIds.has(q.id)).length;
    const reviewed = approved.filter(q => q.reviewed).length;
    const unreviewed = total - reviewed;
    return { ...t, total, available, reviewed, unreviewed };
  }).filter(t => t.total > 0);

  const manageableThemes = isAdmin 
    ? themes 
    : themes.filter(t => {
        if (t.created_by !== session!.player_id) return false;
        if (t.is_locked) return false;
        const hasOtherUsersQs = allQsStats.some(q => q.theme_id === t.id && q.created_by && q.created_by !== session!.player_id);
        return !hasOtherUsersQs;
      });

  /* Estatísticas de contribuições de usuários (admin only) */
  const userContributionStats = (() => {
    if (!isAdmin) return null;
    const userQs = questions.filter(q => !q.is_native && !!q.created_by);
    if (userQs.length === 0) return { total: 0, users: [] };

    const byUser: Record<string, { nickname: string; total: number; byTheme: Record<string, { themeName: string; count: number }> }> = {};
    for (const q of userQs) {
      const uid = q.created_by!;
      const nick = q.creator_nickname ?? 'Desconhecido';
      if (!byUser[uid]) byUser[uid] = { nickname: nick, total: 0, byTheme: {} };
      byUser[uid].total++;
      const tid = q.theme_id ?? '__sem_tema__';
      const tname = q.theme_name ?? 'Sem tema';
      if (!byUser[uid].byTheme[tid]) byUser[uid].byTheme[tid] = { themeName: tname, count: 0 };
      byUser[uid].byTheme[tid].count++;
    }
    const users = Object.entries(byUser)
      .map(([uid, data]) => ({ uid, ...data, themes: Object.values(data.byTheme).sort((a, b) => b.count - a.count) }))
      .sort((a, b) => b.total - a.total);
    return { total: userQs.length, users };
  })();

  const [expandedContribUser, setExpandedContribUser] = useState<string | null>(null);

  const toggleTheme = (id: string) => {
    setFilterThemes(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExportAudit = () => {
    const rows = [
      'Data/Hora;Sessão;Jogador;Nº Perg.;Tema;Ciclo;Pergunta;Tempo Gasto (s);Acertou?;Opção Marcada;Ajudas Usadas',
      ...sortedAudit.map(log => {
        const dateStr = new Date(log.answered_at).toLocaleString();
        const stmt = log.statement.replace(/"/g, '""');
        return `"${dateStr}";${log.session_number};"${log.player_name}";${log.question_num};"${log.theme_name}";${log.theme_cycle || 1};"${stmt}";${log.time_spent};${log.is_correct ? 'Sim' : 'Não'};${log.selected_option};${log.helps_used}`;
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleClearAudit = async () => {
    if (!supabase || !isAdmin) return;
    if (!window.confirm('⚠️ TEM CERTEZA? Isso irá apagar TODO o histórico de auditoria de respostas permanentemente! Esta ação não pode ser desfeita.')) return;
    
    setLoadingAudit(true);
    // Para deletar tudo, usamos um filtro que sempre seja verdadeiro (como id diferente de zero)
    const { error } = await supabase
      .from('question_audit')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      alert('Erro ao limpar histórico: ' + error.message);
    } else {
      setAuditLogs([]);
      alert('Histórico limpo com sucesso!');
    }
    setLoadingAudit(false);
  };

  return (
    <div className="questions-screen">
      {/* O cabeçalho agora fica na Navbar superior */}

      {/* Sticky Header no Topo */}
      <div className="settings-sticky-header" style={{ display: 'flex', gap: '8px', padding: '6px 12px', zIndex: 100, marginBottom: '0.5rem' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/settings')}
          style={{ flex: 1, margin: 0, padding: '5px 8px', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
        >
          ⚙️ Ajustes
        </button>
        <button 
          className="btn-primary" 
          onClick={() => navigate('/select-theme?mode=solo')}
          style={{ 
            flex: 1, 
            margin: 0, 
            padding: '5px 8px', 
            fontSize: '0.85rem', 
            background: 'linear-gradient(135deg, #f5c842 0%, #d35400 100%)', 
            color: '#000', 
            fontWeight: 'bold', 
            border: 'none',
            boxShadow: '0 4px 10px rgba(245, 200, 66, 0.3)'
          }}
        >
          ▶ Iniciar jogo
        </button>
      </div>

      {isAdmin && (
        <div className="audit-tabs" style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.75rem' }}>
          <button 
            className="btn-action-outline"
            onClick={() => setActiveTab('banco')}
            style={{ flex: 1, padding: '6px', fontSize: '0.85rem', backgroundColor: activeTab === 'banco' ? '#f5c842' : 'transparent', color: activeTab === 'banco' ? '#000' : '#fff' }}
          >
            📚 Banco de Perguntas
          </button>
          <button 
            className="btn-action-outline"
            onClick={() => setActiveTab('auditoria')}
            style={{ flex: 1, padding: '6px', fontSize: '0.85rem', backgroundColor: activeTab === 'auditoria' ? '#f5c842' : 'transparent', color: activeTab === 'auditoria' ? '#000' : '#fff' }}
          >
            🕵️‍♂️ Auditoria
          </button>
        </div>
      )}

      <div style={{ display: activeTab === 'banco' ? 'block' : 'none' }}>
        <div className="admin-section-card" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
          {/* Barra de ações */}
          <div className="questions-toolbar" style={{ gap: '6px', marginBottom: '4px' }}>
            <button className="btn-action-yellow questions-btn-primary" style={{ padding: '6px', fontSize: '0.85rem', margin: 0 }} onClick={() => { setEditingQ(null); setShowForm(true); }}>
              ➕ Criar nova pergunta
            </button>

            <div className="questions-toolbar-secondary" style={{ gap: '6px' }}>
              <button className="btn-action-outline" style={{ padding: '4px', fontSize: '0.75rem', margin: 0, flex: 1 }} onClick={() => setShowCsvInstructions(true)}>
                📋 Instruções CSV
              </button>
              <label className="btn-action-outline" onClick={() => setShowImportModal(true)} style={{ padding: '4px', fontSize: '0.75rem', margin: 0, cursor: 'pointer', textAlign: 'center', flex: 1 }}>
                📥 Importar Perguntas
              </label>
              {(isAdmin || questions.length > 0) && (
                <button className="btn-action-outline" style={{ padding: '4px', fontSize: '0.75rem', margin: 0, flex: 1 }} onClick={() => setShowExportDialog(true)}>
                  📤 Exportar CSV
                </button>
              )}
              {(manageableThemes.length > 0) && (
                <button 
                  className="btn-action-outline" 
                  onClick={() => setShowThemesModal(true)} 
                  style={{ padding: '4px', fontSize: '0.75rem', margin: 0, color: '#f5c842', borderColor: '#f5c842', flex: 1 }}
                >
                  🏷️ Adm. de Temas
                </button>
              )}
            </div>
          </div>

          {!isAdmin && !loading && (
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              backgroundColor: 'rgba(255,255,255,0.06)', 
              borderRadius: '12px', 
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.15)'
            }}>
              {questions.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.9)', lineHeight: '1.4' }}>
                  🌟 <strong>Você ainda não criou nenhuma pergunta.</strong><br/>
                  Que tal fazer sua primeira contribuição agora e ajudar a enriquecer o jogo?
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.9)', lineHeight: '1.4' }}>
                  🎯 Parabéns! Você já contribuiu com <strong>{questions.length}</strong> {questions.length === 1 ? 'pergunta' : 'perguntas'}.<br/>
                  Continue compartilhando seu conhecimento com a nossa comunidade!
                </p>
              )}
            </div>
          )}
        </div>

      {csvReport && (
        <pre className="csv-report">{csvReport}</pre>
      )}

      {/* ── Seção de contribuições de usuários (admin only) ── */}
      {isAdmin && !loading && userContributionStats && (
        <div className="admin-section-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 className="section-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>👥 CONTRIBUIÇÕES DE USUÁRIOS</h2>
            <span style={{ fontSize: '0.8rem', background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.4)', color: '#f5c842', borderRadius: '20px', padding: '3px 10px', fontWeight: 700 }}>
              {userContributionStats.total} {userContributionStats.total === 1 ? 'pergunta' : 'perguntas'} no total
            </span>
          </div>

          {userContributionStats.total === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center', margin: '0.5rem 0' }}>Nenhum usuário criou perguntas ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {userContributionStats.users.map(u => (
                <div key={u.uid} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {/* Cabeçalho do usuário */}
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}
                    onClick={() => setExpandedContribUser(prev => prev === u.uid ? null : u.uid)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>👤</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{u.nickname}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(245,200,66,0.15)', color: '#f5c842', border: '1px solid rgba(245,200,66,0.3)', borderRadius: '12px', padding: '2px 9px', fontWeight: 700 }}>
                        {u.total} {u.total === 1 ? 'pergunta' : 'perguntas'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{expandedContribUser === u.uid ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {/* Breakdown por tema */}
                  {expandedContribUser === u.uid && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {u.themes.map(th => (
                        <div key={th.themeName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>📂 {th.themeName}</span>
                          <span style={{ color: '#a78bfa', fontWeight: 600 }}>{th.count} {th.count === 1 ? 'pergunta' : 'perguntas'}</span>
                        </div>
                      ))}
                      <button
                        className="btn-action-outline"
                        style={{ marginTop: '8px', fontSize: '0.75rem', padding: '4px 10px', color: '#f5c842', borderColor: '#f5c842' }}
                        onClick={() => { setFilterUserCreated(true); setExpandedContribUser(null); }}
                      >
                        🔍 Ver perguntas deste usuário
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="screen-center" style={{ minHeight: '300px', padding: '2rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }} />
          <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Carregando temas e perguntas...</p>
        </div>
      ) : (
        <>
          {/* Resumo de respondidas por tema */}
          {themeSummary.length > 0 && (
            <div className="admin-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>LISTA DE TEMAS</h2>
                <button 
                  className="btn-tiny btn-tiny-danger" 
                  onClick={handleResetAll}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Zera seu histórico pessoal em todos os temas"
                >
                  🔄 Reiniciar Tudo
                </button>
              </div>
              <div className="theme-summary-list">
                {themeSummary.map(t => {
                  const isActive = filterThemes.includes(t.id);
                  return (
                    <div 
                      key={t.id} 
                      className={`theme-summary-item ${isActive ? 'active' : ''}`}
                      onClick={() => toggleTheme(t.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span className="theme-summary-name">{t.name}</span>
                          <span className="theme-summary-counts">
                            {t.available}/{t.total} disponíveis
                          </span>
                        </div>
                        {isAdmin && (
                          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                            <span style={{color: '#2ecc71'}}>✅ {t.reviewed} revisadas</span>
                            <span>•</span>
                            <span style={{color: t.unreviewed > 0 ? '#f5c842' : 'inherit'}}>❌ {t.unreviewed} faltam</span>
                          </div>
                        )}
                      </div>
                      {t.available < t.total && (
                        <button 
                          className="btn-reset-tiny" 
                          onClick={(e) => { e.stopPropagation(); handleResetAnswered(t.id); }}
                          title="Reiniciar progresso deste tema"
                        >
                          🔄 Reiniciar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="admin-section-card">
            <h2 className="section-title">OPÇÕES DE FILTRO</h2>
            
            {/* Campo de Busca Livre - Movido para filtros */}
            <div style={{ marginBottom: '1rem' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 Buscar por Nº, pergunta, enunciado, resposta ou ref..." 
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', caretColor: '#f5c842' }}
              />
            </div>

            <div className="filter-bar">
              <select 
                className="filter-select" 
                value={filterThemes.length === 1 ? filterThemes[0] : ''} 
                onChange={e => setFilterThemes(e.target.value ? [e.target.value] : [])}
              >
                <option value="">{filterThemes.length > 1 ? `(${filterThemes.length}) temas selecionados` : 'Todos os temas'}</option>
                {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="inativa">Inativa</option>
              </select>
              <select className="filter-select" value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                <option value="">Todas as dificuldades</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
              </select>
            </div>

            {/* Filtros de toggle 3 estados */}
            <div className="filter-toggles-row">
              {/* Gravuras */}
              <button
                className={`filter-toggle-btn ${filterImage === 'with' ? 'active-yes' : filterImage === 'without' ? 'active-no' : ''}`}
                onClick={() => setFilterImage(prev => prev === '' ? 'with' : prev === 'with' ? 'without' : '')}
                title={filterImage === '' ? 'Clique: com gravura | 2x: sem gravura | 3x: todos' : ''}
              >
                🖼️ Gravuras
                {filterImage === 'with' && <span className="toggle-state-label">✓ Com</span>}
                {filterImage === 'without' && <span className="toggle-state-label">✗ Sem</span>}
              </button>

              {/* Respondidas */}
              <button
                className={`filter-toggle-btn ${filterAnswered === 'answered' ? 'active-yes' : filterAnswered === 'not_answered' ? 'active-no' : ''}`}
                onClick={() => setFilterAnswered(prev => prev === '' ? 'answered' : prev === 'answered' ? 'not_answered' : '')}
              >
                ✓ Respondidas
                {filterAnswered === 'answered' && <span className="toggle-state-label">Sim</span>}
                {filterAnswered === 'not_answered' && <span className="toggle-state-label">Não</span>}
              </button>

              {/* Revisão */}
              <button
                className={`filter-toggle-btn ${filterReviewed === 'reviewed' ? 'active-yes' : filterReviewed === 'not_reviewed' ? 'active-no' : ''}`}
                onClick={() => setFilterReviewed(prev => prev === '' ? 'reviewed' : prev === 'reviewed' ? 'not_reviewed' : '')}
              >
                📝 Revisadas
                {filterReviewed === 'reviewed' && <span className="toggle-state-label">Sim</span>}
                {filterReviewed === 'not_reviewed' && <span className="toggle-state-label">Não</span>}
              </button>
              {/* Solicitações de revisão */}
              <button
                className={`filter-toggle-btn ${filterReviewReq === 'with_review_req' ? 'active-req' : ''}`}
                onClick={() => setFilterReviewReq(prev => prev === '' ? 'with_review_req' : '')}
              >
                🚩 Solicitações
                {filterReviewReq === 'with_review_req' && <span className="toggle-state-label">Com</span>}
              </button>
              {/* Criadas por usuários (admin) */}
              {isAdmin && (
                <button
                  className={`filter-toggle-btn ${filterUserCreated ? 'active-yes' : ''}`}
                  onClick={() => setFilterUserCreated(prev => !prev)}
                  title="Mostrar apenas perguntas criadas por usuários (não nativas)"
                >
                  👥 Por Usuários
                  {filterUserCreated && <span className="toggle-state-label">Ativo</span>}
                </button>
              )}
            </div>
          </div>

          {/* Lista de perguntas */}
          {filtered.length === 0 ? (
            <div className="empty-msg" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              {!isAdmin ? (
                <>
                  <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.6rem', color: '#fff' }}>
                    {questions.length === 0 ? 'Você ainda não criou nenhuma pergunta.' : 'Nenhuma pergunta encontrada com os filtros aplicados.'}
                  </p>
                  
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', marginTop: '0.5rem', textAlign: 'left' }}>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5', margin: 0 }}>
                      💡 <strong>Como funciona:</strong> Nesta tela você visualiza e gerencia apenas as <strong>perguntas que você criou</strong>. 
                      Para adicionar novas, use o botão <strong>➕ Criar nova pergunta</strong> acima.
                    </p>
                    
                    <p style={{ fontSize: '0.8rem', color: '#f5c842', marginTop: '0.8rem', lineHeight: '1.5', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.8rem', fontWeight: 600 }}>
                      ⚠️ Importante: Toda vez que você editar uma pergunta aprovada, ela voltará ao status "Pendente" para que um administrador valide a alteração antes de ela retornar ao jogo.
                    </p>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '0.9rem' }}>Nenhuma pergunta encontrada com os filtros aplicados.</p>
              )}
            </div>
          ) : (
            <div className="questions-list">
              {filtered.map(q => {
            const canEdit = isAdmin || (q.status === 'pendente' && q.created_by === session!.player_id);
            const canDelete = isAdmin || (q.status === 'pendente' && q.created_by === session!.player_id);
            const creator = q.is_native
              ? `Nativo — ${q.creator_nickname}`
              : q.creator_nickname;

            return (
              <div key={q.id} className={`question-card ${q.answered ? 'question-answered' : ''} ${q.reviewed ? 'question-reviewed' : ''}`}>
                <div className="question-card-top">
                  <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty]}</span>
                  <span className={`status-badge status-${q.status}`}>{STATUS_LABEL[q.status]}</span>
                  <span className="theme-badge">{q.theme_name}</span>
                  {q.images && q.images.length > 0 && (
                    <span 
                      className="image-indicator-badge" 
                      title="Clique para ver a gravura"
                      onClick={() => setPreviewImage(q.images[0])}
                      style={{ cursor: 'pointer', background: 'rgba(245, 200, 66, 0.2)', border: '1px solid #f5c842', color: '#f5c842', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}
                    >
                      🖼️ Com Gravura
                    </span>
                  )}
                  {isAdmin && q.reviewed && (
                    <span style={{ background: 'rgba(46,204,113,0.2)', border: '1px solid #2ecc71', color: '#2ecc71', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ Revisada</span>
                  )}
                  {isAdmin && reviewRequests[q.id]?.length > 0 && (
                    <span
                      className="review-req-badge"
                      title={`${reviewRequests[q.id].length} solicitação(ões) de revisão`}
                    >
                      🚩 {reviewRequests[q.id].length} revisão
                    </span>
                  )}
                  {q.answered && <span className="answered-badge">✓ Respondida</span>}
                </div>
                {/* Detalhes das solicitações de revisão (admin) */}
                {isAdmin && reviewRequests[q.id]?.length > 0 && (
                  <div className="review-req-details">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f5c842' }}>
                        🚩 {reviewRequests[q.id].length} solicitação(s) de revisão
                      </span>
                      <button
                        className="btn-resolve-review"
                        onClick={() => handleResolveReviewRequests(q.id)}
                        title="Marcar todas as solicitações desta pergunta como resolvidas"
                      >
                        ✓ Resolver
                      </button>
                    </div>
                    {reviewRequests[q.id].map((rr, i) => (
                      <div key={i} className="review-req-item">
                        <span className="review-req-who">🚩 {rr.player_name}</span>
                        <span className="review-req-date">{new Date(rr.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {rr.message && <span className="review-req-msg">"{rr.message}"</span>}
                      </div>
                    ))}
                  </div>
                )}
                <p className="question-statement">{q.statement}</p>
                <div className="question-options">
                  {(['a','b','c','d'] as const).map(l => (
                    <span key={l} className={`opt-chip ${q.correct_answer === l ? 'opt-correct' : ''}`}>
                      {l.toUpperCase()}) {q[`option_${l}` as 'option_a']}
                    </span>
                  ))}
                </div>
                {q.reference && <p className="question-reference" style={{ fontSize: '0.85rem', color: '#fff', marginTop: '8px', opacity: 0.9, backgroundColor: 'rgba(0,0,0,0.1)', padding: '4px 8px', borderRadius: '4px' }}>Fonte: {q.reference}</p>}
                <div className="question-card-footer">
                  <span className="question-creator">
                    {q.question_number ? <strong style={{color: 'var(--text)'}}>#{q.question_number}</strong> : ''} 👤 {creator}
                  </span>
                  <div className="question-actions">
                    {canEdit && (
                      <button className="btn-tiny" onClick={() => { setEditingQ(q); setShowForm(true); }}>✏️ Editar</button>
                    )}
                    {canDelete && (
                      <button className="btn-tiny btn-tiny-danger" onClick={() => handleDelete(q)}>🗑 Apagar</button>
                    )}
                    {isAdmin && q.status === 'pendente' && (
                      <>
                        <button className="btn-tiny btn-tiny-green" onClick={() => handleStatus(q.id, 'aprovada')}>✓ Aprovar</button>
                        <button className="btn-tiny btn-tiny-danger" onClick={() => handleStatus(q.id, 'rejeitada')}>✗ Rejeitar</button>
                      </>
                    )}
                    {isAdmin && q.status === 'aprovada' && (
                      <button className="btn-tiny" onClick={() => handleStatus(q.id, 'inativa')} style={{ background: '#64748b', color: '#fff' }}>⏸ Inativar</button>
                    )}
                    {isAdmin && q.status === 'inativa' && (
                      <button className="btn-tiny btn-tiny-green" onClick={() => handleStatus(q.id, 'aprovada')}>▶ Reativar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
        </>
      )}

      {/* Modais */}
      {showForm && (
        <QuestionForm
          question={editingQ}
          themes={themes}
          isAdmin={isAdmin}
          playerId={session!.player_id}
          adminInitials={session!.admin_initials}
          onSave={() => { setShowForm(false); setEditingQ(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingQ(null); }}
        />
      )}
      {showCsvInstructions && <CsvInstructionsModal aiPrompt={aiImportPrompt} onClose={() => setShowCsvInstructions(false)} />}
      {showImportModal && (
        <ImportQuestionsModal
          themes={themes}
          session={session!}
          isAdmin={isAdmin}
          onClose={() => setShowImportModal(false)}
          onDone={(report) => { setCsvReport(report); setShowImportModal(false); load(); }}
        />
      )}
      {showThemesModal && (
        <ThemesManagementModal 
          themes={manageableThemes} 
          questions={allQsStats}
          isAdmin={isAdmin}
          playerId={session!.player_id}
          onRefresh={load}
          onClose={() => { setShowThemesModal(false); load(); }} 
        />
      )}
      
      {/* Modal de pré-visualização de imagem */}
      {previewImage && (
        <div className="image-hint-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-hint-box" onClick={e => e.stopPropagation()}>
            <button className="image-hint-close" onClick={() => setPreviewImage(null)}>✕</button>
            <img src={previewImage} alt="Prévia" className="image-hint-modal-img" />
          </div>
        </div>
      )}
      {/* Modal de Exportação */}
      {showExportDialog && (
        <ExportDialog 
          isAdmin={isAdmin}
          themes={themes}
          onClose={() => setShowExportDialog(false)}
          onExportAll={() => { handleCsvExport(); setShowExportDialog(false); }}
          onExportThemeCsv={(t) => { handleCsvExport(t); setShowExportDialog(false); }}
          onExportThemeText={(t) => { handleTextExport(t); setShowExportDialog(false); }}
          copySuccess={copySuccess}
        />
      )}
      </div> {/* Fim da div Banco de Perguntas */}

      {/* ─── ABA DE AUDITORIA ─── */}
      <div style={{ display: activeTab === 'auditoria' ? 'block' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.2rem' }}>
          <h2 className="section-title" style={{ margin: 0, width: '100%', textAlign: 'left' }}>Histórico de Respostas</h2>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button className="btn-action-outline" style={{ flex: 1, padding: '0.6rem' }} onClick={handleExportAudit}>
              📤 Exportar CSV
            </button>
            <button 
              className="btn-action-outline" 
              style={{ flex: 1, padding: '0.6rem', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)' }}
              onClick={handleClearAudit}
            >
              🗑️ Limpar Tudo
            </button>
          </div>
        </div>
        
        {loadingAudit ? (
          <p>Carregando auditoria...</p>
        ) : (
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortAudit('answered_at')}>Data/Hora {sortField === 'answered_at' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('session_number')} style={{ textAlign: 'center' }}>Sessão {sortField === 'session_number' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('player_name')}>Jogador {sortField === 'player_name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('question_num')} style={{ textAlign: 'center' }}>Nº Perg. {sortField === 'question_num' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('theme_name')}>Tema {sortField === 'theme_name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('theme_cycle')} style={{ textAlign: 'center' }}>Ciclo {sortField === 'theme_cycle' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('statement')}>Pergunta {sortField === 'statement' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('time_spent')} style={{ textAlign: 'center' }}>Tempo {sortField === 'time_spent' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('is_correct')} style={{ textAlign: 'center' }}>Acertou {sortField === 'is_correct' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('selected_option')} style={{ textAlign: 'center' }}>Opção {sortField === 'selected_option' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSortAudit('helps_used')} style={{ textAlign: 'center' }}>Ajudas {sortField === 'helps_used' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedAudit.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.answered_at).toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>{log.session_number}</td>
                    <td>{log.player_name}</td>
                    <td style={{ textAlign: 'center' }}>{log.question_num}</td>
                    <td>{log.theme_name}</td>
                    <td style={{ textAlign: 'center' }}>{log.theme_cycle || 1}</td>
                    <td title={log.statement}>{log.statement.length > 40 ? log.statement.substring(0, 40) + '...' : log.statement}</td>
                    <td style={{ textAlign: 'center' }}>{log.time_spent}s</td>
                    <td style={{ textAlign: 'center' }}>{log.is_correct ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{['', 'A', 'B', 'C', 'D'][log.selected_option] || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{log.helps_used}</td>
                  </tr>
                ))}
                {sortedAudit.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '1rem', textAlign: 'center' }}>Nenhum registro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

/* ─── Parser CSV simples com suporte a aspas ─────────────── */
/* ─── Gerenciamento de Temas ───────────────────────────────── */
function ThemesManagementModal({ themes, questions, isAdmin, playerId, onRefresh, onClose }: { themes: Theme[], questions: any[], isAdmin: boolean, playerId: string, onRefresh: () => void, onClose: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addName, setAddName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!addName.trim() || !supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('themes').insert({ name: addName.trim() });
      if (error) throw error;
      setAddName('');
      onRefresh();
    } catch (err: any) {
      alert('Erro ao criar tema: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('themes').update({ name: editName.trim() }).eq('id', id);
      if (error) {
        // Detectar conflito de nome duplicado (409 ou código de constraint)
        const isConflict =
          error.code === '23505' ||
          (error as any)?.status === 409 ||
          error.message?.toLowerCase().includes('conflict') ||
          error.message?.toLowerCase().includes('unique') ||
          error.message?.toLowerCase().includes('duplicate');

        if (isConflict) {
          const shouldMerge = confirm(
            `⚠️ Já existe um tema com o nome "${editName.trim()}".\n\n` +
            `Deseja UNIFICAR os dois temas em um só?\n\n` +
            `• Todas as perguntas do tema atual serão migradas para "${editName.trim()}".\n` +
            `• O tema atual (duplicado) será deletado após a migração.\n\n` +
            `Esta ação NÃO pode ser desfeita.`
          );

          if (!shouldMerge) {
            setLoading(false);
            return;
          }

          // 1. Busca o tema de destino pelo nome
          const { data: targetTheme, error: fetchErr } = await supabase
            .from('themes')
            .select('id, name')
            .ilike('name', editName.trim())
            .neq('id', id)
            .maybeSingle();

          if (fetchErr || !targetTheme) {
            alert('Erro ao buscar o tema de destino: ' + (fetchErr?.message || 'Tema não encontrado.'));
            setLoading(false);
            return;
          }

          // 2. Migra todas as perguntas do tema atual para o tema de destino em lotes
          const { data: questionsToMigrate, error: qFetchErr } = await supabase
            .from('questions')
            .select('id')
            .eq('theme_id', id);

          if (qFetchErr) {
            alert('Erro ao buscar perguntas para migração: ' + qFetchErr.message);
            setLoading(false);
            return;
          }

          if (questionsToMigrate && questionsToMigrate.length > 0) {
            const ids = questionsToMigrate.map((q: any) => q.id);
            const CHUNK = 50;
            for (let i = 0; i < ids.length; i += CHUNK) {
              const chunk = ids.slice(i, i + CHUNK);
              const { error: updateErr } = await supabase
                .from('questions')
                .update({ theme_id: targetTheme.id })
                .in('id', chunk);
              if (updateErr) {
                alert('Erro ao migrar perguntas: ' + updateErr.message);
                setLoading(false);
                return;
              }
            }
          }

          // 3. Deleta o tema duplicado (agora sem perguntas)
          const { error: deleteErr } = await supabase.from('themes').delete().eq('id', id);
          if (deleteErr) {
            alert('Perguntas migradas, mas houve erro ao deletar o tema duplicado: ' + deleteErr.message);
          } else {
            const count = questionsToMigrate?.length ?? 0;
            alert(`✅ Temas unificados com sucesso!\n\n${count} pergunta(s) migrada(s) para "${targetTheme.name}" e o tema duplicado foi removido.`);
          }

          setEditingId(null);
          onRefresh();
          return;
        }

        throw error;
      }

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar tema: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) {
      if (!confirm(`O tema "${name}" possui ${count} pergunta(s) vinculadas.\n\nDeseja APAGAR O TEMA E TODAS AS ${count} PERGUNTAS?\n\nEsta ação NÃO pode ser desfeita.`)) return;
    } else {
      if (!confirm(`Deseja realmente apagar o tema "${name}"?`)) return;
    }
    setLoading(true);
    try {
      if (!supabase) return;
      if (count > 0) {
        // Deleta primeiro as perguntas do tema
        const { error: qErr } = await supabase.from('questions').delete().eq('theme_id', id);
        if (qErr) throw qErr;
      }
      const { error } = await supabase.from('themes').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Erro ao apagar tema: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllQuestions = async (id: string, name: string, count: number) => {
    if (!count) return;
    if (!confirm(`Apagar TODAS as ${count} pergunta(s) do tema "${name}"?\n\nO tema em si será mantido.\n\nEsta ação NÃO pode ser desfeita.`)) return;
    setLoading(true);
    try {
      if (!supabase) return;
      const { error } = await supabase.from('questions').delete().eq('theme_id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Erro ao apagar perguntas: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatus = async (themeId: string, themeName: string, status: 'aprovada' | 'inativa') => {
    const actionLabel = status === 'aprovada' ? 'APROVAR TODAS' : 'INATIVAR TODAS';
    if (!confirm(`Deseja realmente ${actionLabel} as perguntas do tema "${themeName}"?`)) return;
    
    setLoading(true);
    try {
      if (!supabase) return;

      // 1. Busca os IDs das perguntas do tema
      const { data: rows, error: fetchErr } = await supabase
        .from('questions')
        .select('id')
        .eq('theme_id', themeId);
      if (fetchErr) throw fetchErr;
      if (!rows || rows.length === 0) { alert('Nenhuma pergunta encontrada para este tema.'); return; }

      // 2. Atualiza em lotes de 50 (evita timeout e problemas de RLS no iOS)
      const ids = rows.map((r: any) => r.id);
      const CHUNK = 50;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('questions')
          .update({ status, updated_at: new Date().toISOString() })
          .in('id', chunk);
        if (error) throw error;
      }
      
      alert(`Sucesso: ${ids.length} pergunta(s) de "${themeName}" foram marcadas como ${status}.`);
      onRefresh();
    } catch (err: any) {
      alert('Erro na operação em massa: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReview = async (themeId: string, themeName: string, reviewMode: boolean) => {
    const actionLabel = reviewMode ? 'MARCAR COMO REVISADAS' : 'DESMARCAR COMO REVISADAS';
    if (!confirm(`Deseja realmente ${actionLabel} todas as perguntas do tema "${themeName}"?`)) return;
    
    setLoading(true);
    try {
      if (!supabase) return;

      // 1. Busca os IDs das perguntas do tema
      const { data: rows, error: fetchErr } = await supabase
        .from('questions')
        .select('id')
        .eq('theme_id', themeId);
      if (fetchErr) throw fetchErr;
      if (!rows || rows.length === 0) { alert('Nenhuma pergunta encontrada para este tema.'); return; }

      const payload = {
        reviewed: reviewMode,
        reviewed_by: reviewMode ? playerId : null,
        reviewed_at: reviewMode ? new Date().toISOString() : null
      };

      // 2. Atualiza em lotes de 50 (evita timeout e problemas de RLS no iOS)
      const ids = rows.map((r: any) => r.id);
      const CHUNK = 50;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('questions')
          .update(payload)
          .in('id', chunk);
        if (error) throw error;
      }

      alert(`Sucesso: ${ids.length} pergunta(s) de "${themeName}" foram ${reviewMode ? 'marcadas' : 'desmarcadas'} como revisadas.`);
      onRefresh();
    } catch (err: any) {
      alert('Erro na operação em massa: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">🏷️ Gerenciar Temas</h3>
        
        {/* Adicionar novo tema — apenas admin */}
        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <input 
              className="form-input" 
              placeholder="Nome do novo tema..." 
              value={addName} 
              onChange={e => setAddName(e.target.value)}
              style={{ margin: 0, width: '100%' }}
              maxLength={40}
            />
            <button 
              className="btn-primary" 
              onClick={handleCreate} 
              disabled={loading || !addName.trim()} 
              style={{ width: '100%' }}
            >
              {loading ? '...' : 'Adicionar novo tema'}
            </button>
          </div>
        )}

        {!isAdmin && (
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem', textAlign: 'center' }}>
            💡 Para criar um novo tema, use a opção <strong>"➕ Novo tema..."</strong> ao criar uma pergunta.
          </p>
        )}

        <div className="themes-mgmt-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '10px' }}>
          {themes.map(t => {
            const themeQs = questions.filter(q => q.theme_id === t.id);
            const count = themeQs.length;
            const pendingCount = themeQs.filter(q => q.status === 'pendente').length;
            const activeCount = themeQs.filter(q => q.status === 'aprovada').length;
            const reviewedCount = themeQs.filter(q => q.reviewed).length;
            const unreviewedCount = count - reviewedCount;
            const isEditing = editingId === t.id;
            const hasOtherUsersQuestions = themeQs.some(q => q.created_by && q.created_by !== playerId);
            const canEditTheme = isAdmin || (t.created_by === playerId && !hasOtherUsersQuestions && !t.is_locked);

            const userStatsMap: Record<string, { name: string; count: number; lastDate: string }> = {};
            themeQs.forEach(q => {
              const uid = q.created_by || 'admin';
              const name = q.is_native ? `Nativo — ${q.creator?.nickname || 'ADM'}` : (q.creator?.nickname || 'Desconhecido');
              if (!userStatsMap[uid]) {
                userStatsMap[uid] = { name, count: 0, lastDate: q.created_at || '' };
              }
              userStatsMap[uid].count++;
              if (q.created_at && (!userStatsMap[uid].lastDate || new Date(q.created_at) > new Date(userStatsMap[uid].lastDate))) {
                userStatsMap[uid].lastDate = q.created_at;
              }
            });
            const userStatsList = Object.values(userStatsMap).sort((a, b) => b.count - a.count);

            return (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {isEditing ? (
                  /* ── Modo edição: textarea full-width + contador + botões ── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <textarea
                      className="form-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      style={{ margin: 0, width: '100%', resize: 'vertical', lineHeight: '1.4', fontSize: '0.9rem', minHeight: '60px', boxSizing: 'border-box' }}
                      rows={3}
                      autoFocus
                      maxLength={40}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: editName.length >= 38 ? '#ef4444' : editName.length >= 30 ? '#f5c842' : 'rgba(255,255,255,0.35)' }}>
                        {editName.length}/40 caracteres
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-tiny" onClick={() => { setEditingId(null); setEditName(''); }}>Cancelar</button>
                        <button className="btn-tiny btn-tiny-green" onClick={() => handleUpdate(t.id)} disabled={loading || !editName.trim()}>Salvar</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Modo visualização ── */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>
                        Criado por: {t.creator?.nickname || 'Desconhecido'} em {t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : 'Data desconhecida'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{count} perguntas vinculadas</div>
                      
                      {/* Estatísticas de Usuários */}
                      {userStatsList.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#f5c842', marginBottom: '4px' }}>Contribuidores:</div>
                          {userStatsList.map((u, i) => (
                            <div key={i} style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'space-between', borderBottom: i < userStatsList.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none', paddingBottom: i < userStatsList.length - 1 ? '3px' : '0', marginBottom: i < userStatsList.length - 1 ? '3px' : '0' }}>
                              <span>👤 {u.name} ({u.count} {u.count === 1 ? 'perg.' : 'pergs.'})</span>
                              <span>Última: {u.lastDate ? new Date(u.lastDate).toLocaleDateString('pt-BR') : '-'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
                        <span style={{color: pendingCount > 0 ? '#f5c842' : 'inherit'}}>{pendingCount} pendentes</span> • {activeCount} aprovadas
                      </div>
                      {isAdmin && count > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                          <span style={{color: '#2ecc71'}}>✅ {reviewedCount} revisadas</span> • <span style={{color: unreviewedCount > 0 ? '#f5c842' : 'inherit'}}>❌ {unreviewedCount} faltam</span>
                        </div>
                      )}
                      
                      {/* Controle de privacidade */}
                      <div style={{ marginTop: '6px' }}>
                        {canEditTheme ? (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: t.is_private ? '#ff6b6b' : '#2ecc71', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '15px', border: t.is_private ? '1px solid rgba(255, 107, 107, 0.3)' : '1px solid rgba(46, 204, 113, 0.3)' }}>
                            <input 
                              type="checkbox" 
                              checked={t.is_private ?? false} 
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                  if (!supabase) return;
                                  const { error } = await supabase.from('themes').update({ is_private: checked }).eq('id', t.id);
                                  if (error) throw error;
                                  onRefresh();
                                } catch (err: any) {
                                  alert('Erro ao atualizar privacidade do tema: ' + (err.message || err));
                                }
                              }}
                              style={{ accentColor: t.is_private ? '#ff6b6b' : '#2ecc71', cursor: 'pointer' }}
                            />
                            {t.is_private ? '🔒 Privado' : '🔓 Público'}
                          </label>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: t.is_private ? 'rgba(255, 107, 107, 0.6)' : 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.02)', padding: '3px 8px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {t.is_private ? '🔒 Privado' : '🔓 Público'}
                          </span>
                        )}
                      </div>
                      
                      {/* Bloqueio de Tema (Admin only) */}
                      {isAdmin && (
                        <div style={{ marginTop: '4px' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: t.is_locked ? '#ff6b6b' : '#3498db', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '15px', border: t.is_locked ? '1px solid rgba(255, 107, 107, 0.3)' : '1px solid rgba(52, 152, 219, 0.3)' }}>
                            <input 
                              type="checkbox" 
                              checked={t.is_locked ?? false} 
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                  if (!supabase) return;
                                  const { error } = await supabase.from('themes').update({ is_locked: checked }).eq('id', t.id);
                                  if (error) throw error;
                                  onRefresh();
                                } catch (err: any) {
                                  alert('Erro ao atualizar bloqueio do tema: ' + (err.message || err));
                                }
                              }}
                              style={{ accentColor: t.is_locked ? '#ff6b6b' : '#3498db', cursor: 'pointer' }}
                            />
                            {t.is_locked ? '🛑 Edição Bloqueada' : '✅ Edição Liberada'}
                          </label>
                        </div>
                      )}
                    </div>

                    {canEditTheme && (
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button className="btn-tiny" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>✏️</button>
                        <button 
                          className="btn-tiny btn-tiny-danger" 
                          onClick={() => handleDelete(t.id, t.name, count)} 
                          disabled={loading}
                          title="Apagar tema (e todas as perguntas, se houver)"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Ações em Massa (Apenas ADM) */}
                {isAdmin && count > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-tiny btn-tiny-green" 
                        style={{ flex: 1, fontSize: '0.65rem', padding: '6px' }}
                        onClick={() => handleBulkStatus(t.id, t.name, 'aprovada')}
                        disabled={loading || pendingCount === 0}
                      >
                        ✅ Aprovar Todas {pendingCount > 0 && `(${pendingCount})`}
                      </button>
                      <button 
                        className="btn-tiny" 
                        style={{ flex: 1, fontSize: '0.65rem', padding: '6px', background: '#64748b' }}
                        onClick={() => handleBulkStatus(t.id, t.name, 'inativa')}
                        disabled={loading || activeCount === 0}
                      >
                        ⏸ Inativar Todas {activeCount > 0 && `(${activeCount})`}
                      </button>
                      <button 
                        className="btn-tiny btn-tiny-danger" 
                        style={{ flex: 1, fontSize: '0.65rem', padding: '6px' }}
                        onClick={() => handleDeleteAllQuestions(t.id, t.name, count)}
                        disabled={loading}
                      >
                        🗑 Apagar Todas
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-tiny" 
                        style={{ flex: 1, fontSize: '0.65rem', padding: '6px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                        onClick={() => handleBulkReview(t.id, t.name, true)}
                        disabled={loading || unreviewedCount === 0}
                      >
                        ☑️ Marcar Revisadas {unreviewedCount > 0 && `(${unreviewedCount})`}
                      </button>
                      <button 
                        className="btn-tiny" 
                        style={{ flex: 1, fontSize: '0.65rem', padding: '6px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                        onClick={() => handleBulkReview(t.id, t.name, false)}
                        disabled={loading || reviewedCount === 0}
                      >
                        🔲 Desmarcar Revisões {reviewedCount > 0 && `(${reviewedCount})`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn-secondary" onClick={onClose} style={{ marginTop: '20px', width: '100%' }}>Fechar</button>
      </div>
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ';' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}
