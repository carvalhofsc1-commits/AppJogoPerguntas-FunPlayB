# FunPlayB — Regras do projeto

## Sempre atualizar `src/lib/version.ts` a cada commit

Antes de criar qualquer commit neste repositório, atualize `src/lib/version.ts`:

- `version`: incrementar (formato `1.0X.YYY`).
- `build`: data + contador no formato `YYYYMMDD.HHmm`.
- `lastDeploy`: timestamp ISO atual (`-03:00`).
- `notes`: descrição real e específica do que mudou nesse commit — nunca deixar texto de um commit anterior ou de outro projeto (já houve um caso de nota copiada de um app diferente, sem relação com o FunPlayB).

Esse arquivo alimenta a tela de "notas de versão" mostrada ao usuário, então as notas devem ser compreensíveis para o jogador final (evitar jargão técnico de commit).
