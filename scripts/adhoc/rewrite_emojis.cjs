const fs = require('fs');
let lines = fs.readFileSync('src/index.css', 'utf8').split('\n');

const correctBlock = [
".animacaoTriste { display: none; }",
".mostrar-animacaoTriste { display: block; }",
".ocultar-animacaoTriste { display: none; }",
".animacaoTriste.mostrar-animacaoTriste::after { content: '😞'; animation: trocarRostoTriste 1.5s steps(5) infinite; font-size: 64px; line-height: 64px; display: inline; vertical-align: middle; }",
"@keyframes trocarRostoTriste { 0% { content: '😞'; } 20% { content: '😩'; } 40% { content: '😩'; } 60% { content: '😩'; } 80% { content: '😞'; } 100% { content: '😔'; } }",
"",
".animacaoFeliz { display: none; }",
".mostrar-animacaoFeliz { display: block; }",
".animacaoFeliz.mostrar-animacaoFeliz::after { content: '🙂'; animation: trocarRostoFeliz 2s steps(5) infinite; font-size: 64px; line-height: 64px; display: inline; vertical-align: middle; }",
"@keyframes trocarRostoFeliz { 0% { content: '🙂'; } 20% { content: '😃'; } 40% { content: '😀'; } 60% { content: '😄'; } 80% { content: '😁'; } 100% { content: '😊'; } }",
"",
".animacaoErrou { display: none; }",
".mostrar-animacaoErrou { display: block; }",
".animacaoErrou.mostrar-animacaoErrou::after { content: '😕'; animation: trocarRostoErrou 2s steps(5) infinite; font-size: 64px; line-height: 64px; display: inline; vertical-align: middle; }",
"@keyframes trocarRostoErrou { 0% { content: '😒'; } 20% { content: '😞'; } 40% { content: '😒'; } 60% { content: '😒'; } 80% { content: '😒'; } 100% { content: '😒'; } }",
"",
".animacaoPensativa { display: none; }",
".mostrar-animacaoPensativa { display: block; }",
".animacaoPensativa.mostrar-animacaoPensativa::after { content: '🤔'; animation: trocarRostoPensativo 20s steps(4) infinite; font-size: 64px; line-height: 64px; display: inline-block; vertical-align: middle; }",
"@keyframes trocarRostoPensativo { 0% { content: '🤔'; } 10% { content: '🤔'; } 20% { content: '🧐'; } 30% { content: '😐'; } 40% { content: '🤨'; } 50% { content: '🤔'; } 60% { content: '😐'; } 70% { content: '🧐'; } 80% { content: '🤨'; } 90% { content: '🤔'; } 100% { content: '🧐'; } }",
"",
".animacaoPreocupado { display: none; }",
".mostrar-animacaoPreocupado { display: block; }",
".animacaoPreocupado.mostrar-animacaoPreocupado::after { content: '😥'; animation: trocarRostoPreocupado 3s steps(5) infinite; font-size: 64px; line-height: 64px; display: inline-block; vertical-align: middle; }",
"@keyframes trocarRostoPreocupado { 0% { content: '😥'; } 20% { content: '😓'; } 40% { content: '😥'; } 60% { content: '😥'; } 80% { content: '😓'; } 100% { content: '😥'; } }"
];

// Replace from line 2646 (index 2645) for 26 lines
lines.splice(2645, 26, ...correctBlock);
fs.writeFileSync('src/index.css', lines.join('\n'), 'utf8');
console.log('Replaced successfully!');
