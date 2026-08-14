import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { VoiceProfile } from '@/types/game';

interface VoiceProfileManagerProps {
  onClose: () => void;
  onUpdate: () => void;
}

const EMPTY_FORM: Partial<VoiceProfile> = {
  name: '',
  countdown_phrases: [],
  correct_phrases: [],
  wrong_phrases: [],
  timeout_phrases: [],
  skip_phrases: [],
  finish_phrases: [],
  mic_prompts: [],
  mic_prompt: 'Pode responder',
  pause_on_wrong: false,
};

const labelStyle: React.CSSProperties = { color: '#f5c842', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', display: 'block' };
const hintStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: '0.73rem', marginTop: '2px', marginBottom: '4px' };

export function VoiceProfileManager({ onClose, onUpdate }: VoiceProfileManagerProps) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<VoiceProfile>>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('voice_profiles').select('*').order('name');
    if (data) setProfiles(data);
    setLoading(false);
  };

  const handleEdit = (profile: VoiceProfile) => {
    setEditingId(profile.id);
    const newForm: any = { ...profile };
    const arrayFields = ['countdown_phrases', 'correct_phrases', 'wrong_phrases', 'timeout_phrases', 'skip_phrases', 'finish_phrases', 'mic_prompts'];
    arrayFields.forEach(f => {
      if (Array.isArray(newForm[f])) newForm[f] = newForm[f].join('\n');
      else if (typeof newForm[f] !== 'string') newForm[f] = '';
    });
    setFormData(newForm);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ ...EMPTY_FORM, name: 'Nova Variante' });
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm('Excluir esta variante permanentemente?')) return;
    await supabase.from('voice_profiles').delete().eq('id', id);
    loadProfiles();
    onUpdate();
  };

  const handleSave = async () => {
    if (!supabase) return;
    if (!formData.name) return alert('Nome é obrigatório');

    const cleanArr = (val: any) => {
      if (typeof val === 'string') return val.split('\n').filter(s => s.trim() !== '');
      if (Array.isArray(val)) return val.filter(s => typeof s === 'string' && s.trim() !== '');
      return [];
    };

    const payload = {
      name: formData.name,
      countdown_phrases: cleanArr(formData.countdown_phrases),
      correct_phrases: cleanArr(formData.correct_phrases),
      wrong_phrases: cleanArr(formData.wrong_phrases),
      timeout_phrases: cleanArr(formData.timeout_phrases),
      skip_phrases: cleanArr(formData.skip_phrases),
      finish_phrases: cleanArr(formData.finish_phrases),
      mic_prompts: cleanArr(formData.mic_prompts),
      mic_prompt: cleanArr(formData.mic_prompts)[0] || 'Pode responder',
      pause_on_wrong: !!formData.pause_on_wrong,
    };

    if (editingId === 'new') {
      await supabase.from('voice_profiles').insert(payload);
    } else {
      await supabase.from('voice_profiles').update(payload).eq('id', editingId);
    }

    setEditingId(null);
    loadProfiles();
    onUpdate();
  };

  const handleChange = (field: string, val: string) => {
    setFormData({ ...formData, [field]: val });
  };



  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#1e1e30', padding: '24px', borderRadius: '18px', width: '92%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', border: '2px solid rgba(245,200,66,0.25)', boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>
        <h2 style={{ marginTop: 0, color: '#f5c842', fontSize: '1.1rem' }}>🎙️ Gerenciar Variantes de Voz</h2>

        {editingId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Nome da Variante</label>
              <input type="text" className="form-input" style={{ color: '#fff' }} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>

            {/* CONTAGEM */}
            <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
              <legend style={{ color: '#f5c842', fontSize: '0.8rem', padding: '0 6px' }}>⏱️ Abertura</legend>
              <div>
                <label style={labelStyle}>Frases de Contagem (Uma por linha)</label>
                <p style={hintStyle}>Narradas em sequência antes do jogo começar.</p>
                <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.countdown_phrases || ''} onChange={e => handleChange('countdown_phrases', e.target.value)} placeholder="3\n2\n1\nValendo!" />
              </div>
            </fieldset>

            {/* ACERTO / ERRO */}
            <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
              <legend style={{ color: '#f5c842', fontSize: '0.8rem', padding: '0 6px' }}>✅ Acerto / ❌ Erro</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Frases de Acerto</label>
                  <p style={hintStyle}>Alterna em sequência a cada acerto.</p>
                  <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.correct_phrases || ''} onChange={e => handleChange('correct_phrases', e.target.value)} placeholder="Parabéns, você acertou!\nIsso aí, correto!\nMuito bem!" />
                </div>
                <div>
                  <label style={labelStyle}>Frases de Erro</label>
                  <p style={hintStyle}>Alterna em sequência a cada erro.</p>
                  <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.wrong_phrases || ''} onChange={e => handleChange('wrong_phrases', e.target.value)} placeholder="Que pena, incorreto.\nOps, você errou!\nTorta na cara!" />
                </div>
                <div>
                  <label style={labelStyle}>Frases de Tempo Esgotado</label>
                  <p style={hintStyle}>Alterna em sequência quando o tempo da pergunta acabar.</p>
                  <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.timeout_phrases || ''} onChange={e => handleChange('timeout_phrases', e.target.value)} placeholder="Que pena, o tempo acabou.\nTempo esgotado, seja mais rápido na próxima." />
                </div>
              </div>
            </fieldset>

            {/* PULAR / FIM */}
            <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
              <legend style={{ color: '#f5c842', fontSize: '0.8rem', padding: '0 6px' }}>⏭️ Pular / 🏁 Fim</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Frases ao Pular Pergunta</label>
                  <p style={hintStyle}>Narrada quando o jogador pular uma pergunta.</p>
                  <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.skip_phrases || ''} onChange={e => handleChange('skip_phrases', e.target.value)} placeholder="Ok, pulando pergunta!\nAdiante!\nPróxima!" />
                </div>
                <div>
                  <label style={labelStyle}>Frases de Fim de Rodada</label>
                  <p style={hintStyle}>Narrada ao terminar a última pergunta, antes da frase motivacional.</p>
                  <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.finish_phrases || ''} onChange={e => handleChange('finish_phrases', e.target.value)} placeholder="Bravo! Chegou ao fim!\nParabéns, completou a rodada!\nIncrível, finalizou!" />
                </div>
              </div>
            </fieldset>

            {/* MICROFONE */}
            <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
              <legend style={{ color: '#f5c842', fontSize: '0.8rem', padding: '0 6px' }}>🎤 Microfone</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Frases para Habilitar Microfone (Uma por linha)</label>
                  <p style={hintStyle}>Alternadas em sequência antes de cada pergunta abrir o mic.</p>
                  <textarea className="form-input" style={{ color: '#fff', resize: 'vertical' }} rows={3} value={formData.mic_prompts || ''} onChange={e => handleChange('mic_prompts', e.target.value)} placeholder="Pode responder\nDiga sua resposta\nFala aí!\nQual é a resposta?" />
                </div>
              </div>
            </fieldset>

            {/* PAUSAR AO ERRAR */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <label style={{ ...labelStyle, margin: 0 }}>Pausar ao Errar? (Ex: Torta na cara)</label>
                <p style={hintStyle}>Aguarda clique manual antes de avançar quando errar.</p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={!!formData.pause_on_wrong} onChange={e => setFormData({ ...formData, pause_on_wrong: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button className="btn-action" onClick={handleSave} style={{ flex: 1, backgroundColor: '#4caf50', borderRadius: '25px', border: 'none' }}>💾 Salvar</button>
              <button className="btn-action-outline" onClick={() => setEditingId(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {loading ? <p style={{ color: '#fff' }}>Carregando...</p> : profiles.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{p.name}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn-action-outline" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleEdit(p)}>✏️</button>
                    <button className="btn-action-outline" style={{ padding: '5px 10px', fontSize: '0.8rem', borderColor: '#f44336', color: '#f44336' }} onClick={() => handleDelete(p.id)}>🗑️</button>
                  </div>
                </div>
              ))}
              {profiles.length === 0 && !loading && <p style={{ color: 'rgba(255,255,255,0.5)' }}>Nenhuma variante criada ainda.</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-action" onClick={handleAddNew} style={{ flex: 1, borderRadius: '25px' }}>+ Criar Variante</button>
              <button className="btn-action-outline" onClick={onClose} style={{ flex: 1, borderRadius: '25px' }}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
