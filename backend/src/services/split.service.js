// Split Expenses domain logic: equal-split helper, per-member balances, and a
// greedy "who owes whom" simplifier that minimises the number of transfers.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Divides `amount` equally across `memberIds`, distributing rounding remainder
// (in paise) to the first members so the shares always sum back to `amount`.
export const equalSplits = (amount, memberIds) => {
  const n = memberIds.length;
  if (n === 0) return [];
  const totalPaise = Math.round(amount * 100);
  const base = Math.floor(totalPaise / n);
  let remainder = totalPaise - base * n;
  return memberIds.map((memberId) => {
    const paise = base + (remainder-- > 0 ? 1 : 0);
    return { memberId, amount: paise / 100 };
  });
};

// Computes each member's net position from expenses, shares and settlements.
//   net > 0  → the group owes this member (they are a creditor)
//   net < 0  → this member owes the group (they are a debtor)
// paid  = total this member paid up front for shared expenses
// owed  = total of this member's own shares across all expenses
export const computeBalances = (group) => {
  const acc = new Map(
    group.members.map((m) => [m.id, { memberId: m.id, name: m.name, isYou: m.isYou, paid: 0, owed: 0 }])
  );

  for (const exp of group.expenses) {
    const payer = acc.get(exp.paidById);
    if (payer) payer.paid += exp.amount;
    for (const s of exp.shares) {
      const member = acc.get(s.memberId);
      if (member) member.owed += s.amount;
    }
  }

  for (const st of group.settlements) {
    // The payer settles a debt (net rises); the receiver is paid back (net falls).
    const from = acc.get(st.fromId);
    const to = acc.get(st.toId);
    if (from) from.paid += st.amount;
    if (to) to.owed += st.amount;
  }

  return [...acc.values()].map((b) => ({
    ...b,
    paid: round2(b.paid),
    owed: round2(b.owed),
    net: round2(b.paid - b.owed),
  }));
};

// Greedy debt simplification: repeatedly settle the biggest creditor against the
// biggest debtor. Produces at most (members - 1) transfers.
export const simplifyDebts = (balances) => {
  const creditors = balances
    .filter((b) => b.net > 0.009)
    .map((b) => ({ id: b.memberId, name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -0.009)
    .map((b) => ({ id: b.memberId, name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debit = debtors[di];
    const pay = round2(Math.min(credit.amount, debit.amount));
    if (pay > 0) {
      transfers.push({
        fromId: debit.id,
        fromName: debit.name,
        toId: credit.id,
        toName: credit.name,
        amount: pay,
      });
    }
    credit.amount = round2(credit.amount - pay);
    debit.amount = round2(debit.amount - pay);
    if (credit.amount <= 0.009) ci++;
    if (debit.amount <= 0.009) di++;
  }
  return transfers;
};
