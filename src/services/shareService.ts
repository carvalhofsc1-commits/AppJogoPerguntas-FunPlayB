// shareService.ts — legado. As funções de QR/pack compartilhado eram da v1.
// Na v2 o compartilhamento de perguntas é feito via CSV import/export.
// Mantido apenas para não quebrar imports residuais.

export const shareServiceLegacy = 'desativado-v2';

// Stubs para satisfazer qualquer import antigo residual
export function buildShareFile() { return null; }
export function shareFileToJson() { return ''; }
export async function importShareFileJson() { return { error: 'Use o import CSV na v2' }; }
export async function buildQrDataUrl() { return { error: 'Desativado na v2' }; }
export function buildQrPayloadEmbedded() { return null; }
export function buildQrPayloadCloud() { return null; }
export async function consumeQrPayload() { return { error: 'Desativado na v2' }; }
