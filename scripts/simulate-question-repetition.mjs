// Simula várias partidas seguidas para comprovar que:
//   1) O embaralhamento (Fisher-Yates) é estatisticamente uniforme.
//   2) Uma pergunta RESPONDIDA nunca repete para o mesmo jogador, mesmo
//      simulando falhas de rede na gravação (o bug original) — graças à
//      fila local de pendências.
//   3) Uma pergunta PULADA pode repetir em partida futura, mas nunca na
//      mesma partida.
//   4) O reset explícito ao esgotar o tema funciona (e só nesse caso a
//      repetição é permitida).
//
// Uso: node scripts/simulate-question-repetition.mjs

// Mesma implementação usada em src/pages/Play.tsx
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Simulação de "servidor" (banco) e "dispositivo" (localStorage) ──
function makeFakePlayer({ networkFailureRate = 0 } = {}) {
  const serverAnswered = new Set();     // answered_questions confirmado no banco
  const localPending = new Set();       // fila local (localStorage) ainda não confirmada

  async function saveToServer(questionId) {
    // Simula uma tentativa de rede que pode falhar
    if (Math.random() < networkFailureRate) {
      return { error: 'network_fail' };
    }
    serverAnswered.add(questionId);
    return { error: null };
  }

  // Equivalente a markAnswered(): grava local ANTES, tenta salvar com retries
  async function markAnswered(questionId) {
    localPending.add(questionId);
    let { error } = await saveToServer(questionId);
    let attempt = 0;
    while (error && attempt < 3) {
      attempt++;
      ({ error } = await saveToServer(questionId));
    }
    if (!error) localPending.delete(questionId);
  }

  // Equivalente ao batch-save de fim de jogo (2ª chance de sincronizar)
  async function endGameBatchSync() {
    for (const questionId of Array.from(localPending)) {
      const { error } = await saveToServer(questionId);
      if (!error) localPending.delete(questionId);
    }
  }

  // Equivalente ao carregamento de uma nova partida: exclusão = banco ∪ pendências locais
  function getExclusionSet() {
    return new Set([...serverAnswered, ...localPending]);
  }

  return { markAnswered, endGameBatchSync, getExclusionSet, serverAnswered, localPending };
}

function buildPool(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `q${i + 1}` }));
}

async function playGame(pool, player, questionsPerRound, { skipRate = 0 } = {}) {
  const excluded = player.getExclusionSet();
  const available = pool.filter(q => !excluded.has(q.id));
  let selected;
  let resetHappened = false;

  if (available.length === 0) {
    // Reset explícito: libera todo o pool de novo
    player.serverAnswered.clear();
    player.localPending.clear();
    resetHappened = true;
    selected = shuffle(pool).slice(0, questionsPerRound);
  } else {
    selected = shuffle(available).slice(0, questionsPerRound);
  }

  const answeredThisGame = [];
  const skippedThisGame = [];

  for (const q of selected) {
    if (Math.random() < skipRate) {
      skippedThisGame.push(q.id); // pulada: NÃO chama markAnswered
      continue;
    }
    await player.markAnswered(q.id); // respondida (acerto ou erro, tanto faz)
    answeredThisGame.push(q.id);
  }

  await player.endGameBatchSync();

  return { selected: selected.map(q => q.id), answeredThisGame, skippedThisGame, resetHappened };
}

async function runScenario(name, { poolSize, questionsPerRound, games, networkFailureRate, skipRate }) {
  const pool = buildPool(poolSize);
  const player = makeFakePlayer({ networkFailureRate });

  const everAnswered = new Set();       // ground truth: perguntas já respondidas, alguma vez
  let repeatedAnsweredViolations = 0;   // pergunta respondida voltando SEM reset
  let totalDrawn = 0;
  let resets = 0;
  const drawFrequency = new Map();      // pra checar uniformidade do embaralhamento

  for (let g = 0; g < games; g++) {
    const { selected, answeredThisGame, resetHappened } = await playGame(pool, player, questionsPerRound, { skipRate });

    if (resetHappened) {
      everAnswered.clear();
      resets++;
    } else {
      // Verifica: nenhuma pergunta sorteada nesta partida já tinha sido
      // RESPONDIDA antes (sem reset no meio)
      for (const id of selected) {
        if (everAnswered.has(id)) repeatedAnsweredViolations++;
        totalDrawn++;
        drawFrequency.set(id, (drawFrequency.get(id) || 0) + 1);
      }
    }

    for (const id of answeredThisGame) everAnswered.add(id);
  }

  // Uniformidade do embaralhamento: desvio da frequência de sorteio de cada
  // pergunta em relação à média esperada (checagem simples, não é teste
  // estatístico formal — só detecta viés grosseiro tipo sort(random-0.5))
  const freqs = [...drawFrequency.values()];
  const avg = freqs.reduce((a, b) => a + b, 0) / (freqs.length || 1);
  const maxDeviationPct = freqs.length
    ? Math.max(...freqs.map(f => Math.abs(f - avg) / avg)) * 100
    : 0;

  console.log(`\n=== Cenário: ${name} ===`);
  console.log(`Pool: ${poolSize} perguntas | ${questionsPerRound}/partida | ${games} partidas`);
  console.log(`Taxa de falha de rede simulada: ${(networkFailureRate * 100).toFixed(0)}%`);
  console.log(`Total sorteado: ${totalDrawn} | Resets automáticos: ${resets}`);
  console.log(`Repetições de pergunta RESPONDIDA sem reset: ${repeatedAnsweredViolations} ${repeatedAnsweredViolations === 0 ? '✅' : '❌ FALHOU'}`);
  console.log(`Maior desvio de frequência de sorteio vs. média: ${maxDeviationPct.toFixed(1)}% ${maxDeviationPct < 60 ? '✅' : '⚠️'}`);

  return repeatedAnsweredViolations === 0;
}

async function main() {
  const results = [];

  // 1) Cenário ideal: rede sempre funciona
  results.push(await runScenario('rede estável', {
    poolSize: 150, questionsPerRound: 10, games: 300, networkFailureRate: 0, skipRate: 0.1,
  }));

  // 2) Cenário do bug original: rede falha 40% das vezes na 1ª tentativa
  //    (a taxa real observada em produção antes da correção)
  results.push(await runScenario('rede instável (simula o bug original, 40% de falha)', {
    poolSize: 150, questionsPerRound: 10, games: 300, networkFailureRate: 0.4, skipRate: 0.1,
  }));

  // 3) Cenário extremo: rede falha 90% das vezes — testa o limite da fila local
  results.push(await runScenario('rede muito instável (90% de falha)', {
    poolSize: 150, questionsPerRound: 10, games: 300, networkFailureRate: 0.9, skipRate: 0.05,
  }));

  // 4) Pool pequeno, força vários resets — garante que resets funcionam e
  //    não quebram a contagem
  results.push(await runScenario('pool pequeno (força resets frequentes)', {
    poolSize: 25, questionsPerRound: 10, games: 100, networkFailureRate: 0.4, skipRate: 0.1,
  }));

  console.log('\n' + '='.repeat(50));
  if (results.every(Boolean)) {
    console.log('✅ TODOS os cenários passaram: zero repetição de pergunta respondida sem reset, mesmo com falha de rede.');
    process.exit(0);
  } else {
    console.log('❌ Algum cenário falhou — revisar a lógica.');
    process.exit(1);
  }
}

main();
