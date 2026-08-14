import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { Question } from '@/types/question';

const DB_NAME = 'jogo_perguntas';
const STORE_KEY = 'jogo_perguntas_web_cache_v1';

let sqliteConn: SQLiteConnection | null = null;
let dbNative: SQLiteDBConnection | null = null;

const DDL = `
CREATE TABLE IF NOT EXISTS questions_local (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  pack_id TEXT,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions_local(source);
`;

function isWebDev(): boolean {
  return Capacitor.getPlatform() === 'web';
}

type WebRow = { id: string; source: string; pack_id: string | null; payload: string; updated_at: number };

function readWebStore(): { rows: WebRow[]; meta: Record<string, string> } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { rows: [], meta: {} };
    return JSON.parse(raw) as { rows: WebRow[]; meta: Record<string, string> };
  } catch {
    return { rows: [], meta: {} };
  }
}

function writeWebStore(rows: WebRow[], meta: Record<string, string>) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ rows, meta }));
}

export async function initLocalDb(): Promise<void> {
  if (isWebDev()) return;
  sqliteConn = new SQLiteConnection(CapacitorSQLite);
  const ret = await sqliteConn.checkConnectionsConsistency();
  const isConn = (await sqliteConn.isConnection(DB_NAME, false)).result;
  if (!ret.result && isConn) {
    await sqliteConn.closeConnection(DB_NAME, false);
  }
  dbNative = await sqliteConn.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await dbNative.open();
  await dbNative.execute(DDL);
}

export async function getMeta(key: string): Promise<string | null> {
  if (isWebDev()) {
    return readWebStore().meta[key] ?? null;
  }
  if (!dbNative) return null;
  const r = await dbNative.query('SELECT value FROM meta_kv WHERE key = ?', [key]);
  const row = r.values?.[0] as { value: string } | undefined;
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  if (isWebDev()) {
    const s = readWebStore();
    s.meta[key] = value;
    writeWebStore(s.rows, s.meta);
    return;
  }
  if (!dbNative) return;
  await dbNative.run('INSERT OR REPLACE INTO meta_kv (key, value) VALUES (?, ?)', [key, value]);
}

export async function replaceOfficialQuestions(questions: Question[]): Promise<void> {
  const now = Date.now();
  if (isWebDev()) {
    const s = readWebStore();
    const rest = s.rows.filter((r) => r.source !== 'official');
    const rows: WebRow[] = [
      ...rest,
      ...questions.map((q) => ({
        id: q.id,
        source: 'official',
        pack_id: null,
        payload: JSON.stringify(q),
        updated_at: now,
      })),
    ];
    writeWebStore(rows, s.meta);
    return;
  }
  if (!dbNative) throw new Error('DB não inicializado');
  await dbNative.execute('BEGIN TRANSACTION');
  try {
    await dbNative.run(`DELETE FROM questions_local WHERE source = ?`, ['official']);
    for (const q of questions) {
      await dbNative.run(
        `INSERT INTO questions_local (id, source, pack_id, payload, updated_at) VALUES (?, ?, NULL, ?, ?)`,
        [q.id, 'official', JSON.stringify(q), now],
      );
    }
    await dbNative.execute('COMMIT');
  } catch (e) {
    await dbNative.execute('ROLLBACK');
    throw e;
  }
}

/** `packId` obrigatório para `community` e `imported` (substitui o lote inteiro). */
export async function upsertQuestions(
  questions: Question[],
  source: Exclude<Question['source'], 'official'>,
  packId: string,
): Promise<void> {
  const now = Date.now();
  if (isWebDev()) {
    const s = readWebStore();
    const without = s.rows.filter((r) => !(r.source === source && r.pack_id === packId));
    const rows: WebRow[] = [
      ...without,
      ...questions.map((q) => ({
        id: q.id,
        source,
        pack_id: packId,
        payload: JSON.stringify({ ...q, source, packId }),
        updated_at: now,
      })),
    ];
    writeWebStore(rows, s.meta);
    return;
  }
  if (!dbNative) throw new Error('DB não inicializado');
  await dbNative.execute('BEGIN TRANSACTION');
  try {
    await dbNative.run(`DELETE FROM questions_local WHERE source = ? AND pack_id = ?`, [source, packId]);
    for (const q of questions) {
      const full = { ...q, source, packId };
      await dbNative.run(
        `INSERT OR REPLACE INTO questions_local (id, source, pack_id, payload, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [q.id, source, packId, JSON.stringify(full), now],
      );
    }
    await dbNative.execute('COMMIT');
  } catch (e) {
    await dbNative.execute('ROLLBACK');
    throw e;
  }
}

function parseQuestionPayload(payload: string): Question | null {
  try {
    return JSON.parse(payload) as Question;
  } catch (e) {
    console.error('[localDb] Payload de pergunta corrompido, ignorando linha:', e);
    return null;
  }
}

export async function getAllPlayable(): Promise<Question[]> {
  if (isWebDev()) {
    return readWebStore().rows
      .map((r) => parseQuestionPayload(r.payload))
      .filter((q): q is Question => q !== null);
  }
  if (!dbNative) return [];
  const res = await dbNative.query('SELECT payload FROM questions_local', []);
  const vals = res.values ?? [];
  return vals
    .map((row) => parseQuestionPayload((row as { payload: string }).payload))
    .filter((q): q is Question => q !== null);
}
