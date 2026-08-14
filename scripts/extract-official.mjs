/**
 * Extrai PERGUNTAS_FILE_DATA de ../JogoTeste4_Completa.html e grava public/data/official.json
 * Uso: npm run extract:official
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, '..', 'JogoTeste4_Completa.html');
const outPath = path.join(root, 'public', 'data', 'official.json');

function difficultyFromPoints(p) {
  if (p === 2) return 'Fácil';
  if (p === 10) return 'Média';
  if (p === 22) return 'Difícil';
  return 'Desconhecida';
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const campos = trimmed.match(/(".*?"|[^;]+)(?=;|$)/g);
  if (!campos || campos.length < 10) return null;
  const clean = (s) => s.replace(/"/g, '');
  const pontosValor = parseInt(clean(campos[8]), 10);
  return {
    id: `official:${clean(campos[0])}`,
    text: clean(campos[1]),
    options: [clean(campos[2]), clean(campos[3]), clean(campos[4]), clean(campos[5])],
    correctIndex: parseInt(clean(campos[6]), 10),
    sourceRef: clean(campos[7]),
    points: pontosValor,
    theme: clean(campos[9]),
    source: 'official',
    difficulty: difficultyFromPoints(pontosValor),
  };
}

function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error('Arquivo não encontrado:', htmlPath);
    process.exit(1);
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('const PERGUNTAS_FILE_DATA =`');
  if (start === -1) {
    console.error('Marcador PERGUNTAS_FILE_DATA não encontrado.');
    process.exit(1);
  }
  const from = html.indexOf('`', start) + 1;
  const to = html.indexOf('`;', from);
  if (to === -1) {
    console.error('Fim do bloco de dados não encontrado.');
    process.exit(1);
  }
  const block = html.slice(from, to);
  const questions = [];
  for (const line of block.trim().split('\n')) {
    const q = parseLine(line);
    if (q) questions.push(q);
  }
  const version = new Date().toISOString().slice(0, 10) + '.' + questions.length;
  const bundle = { version, questions };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 0), 'utf8');
  console.log('Escrito', outPath, '—', questions.length, 'perguntas, versão', version);
}

main();
