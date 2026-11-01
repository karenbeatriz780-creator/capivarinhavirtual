// Dispara a cópia de segurança das músicas pagas 1 VEZ POR DIA, na virada do dia
// (00:10 no horário de Brasília = 03:10 UTC). O serviço de música apaga o arquivo
// em ~7 dias; a cópia diária dos últimos 8 dias pega cada música várias vezes antes disso.
export const config = { schedule: '10 3 * * *' };
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  if (!base) return;
  try { await fetch(base + '/.netlify/functions/guardar-audios-background', { method: 'POST' }); } catch (e) { console.error('backup-audios-agendado:', e && e.message); }
};
