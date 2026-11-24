import { registrarSaldoKie } from './_gastos.mjs';
// A CADA 30 MIN: anota o saldo de créditos da Kie (o painel calcula o gasto do dia com isso)
export const config = { schedule: '0 * * * *' };
export default async () => { await registrarSaldoKie(); };
