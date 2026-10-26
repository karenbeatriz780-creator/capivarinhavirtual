// Dispara a cópia de segurança das músicas pagas A CADA 15 MINUTOS, sozinho.
// (O serviço de música apaga o arquivo em ~7 dias; a cópia precisa sair antes disso.)
export const config = { schedule: '*/15 * * * *' };
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  if (!base) return;
  try { await fetch(base + '/.netlify/functions/guardar-audios-background', { method: 'POST' }); } catch (e) { console.error('backup-audios-agendado:', e && e.message); }
};
