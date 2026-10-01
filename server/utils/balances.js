// Shares each expense equally among participants and returns net balances + simplified settlements.
export function computeBalances(expenses) {
  const net = {};
  const add = (id, v) => { net[id] = (net[id] || 0) + v; };
  let total = 0;
  for (const e of expenses) {
    const parts = (e.participants?.length ? e.participants : [e.paidBy]).map(String);
    const share = e.amount / parts.length;
    total += e.amount;
    add(String(e.paidBy), e.amount);
    parts.forEach(p => add(p, -share));
  }
  const round = (n) => Math.round(n * 100) / 100;
  const creditors = [], debtors = [];
  Object.entries(net).forEach(([id, v]) => { v = round(v); if (v > 0.01) creditors.push({ id, v }); else if (v < -0.01) debtors.push({ id, v: -v }); });
  creditors.sort((a, b) => b.v - a.v); debtors.sort((a, b) => b.v - a.v);
  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: round(amt) });
    debtors[i].v -= amt; creditors[j].v -= amt;
    if (debtors[i].v < 0.01) i++;
    if (creditors[j].v < 0.01) j++;
  }
  return { total: round(total), net: Object.fromEntries(Object.entries(net).map(([k, v]) => [k, round(v)])), settlements };
}
