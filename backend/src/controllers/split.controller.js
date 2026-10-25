import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';
import { equalSplits, computeBalances, simplifyDebts } from '../services/split.service.js';

// Loads a group the caller owns, or throws 404. `full` pulls members, expenses
// (with shares) and settlements for the detail view / balance computation.
const loadOwnedGroup = async (id, userId, full = false) => {
  const group = await prisma.splitGroup.findFirst({
    where: { id, ownerId: userId },
    include: full
      ? {
          members: { orderBy: { createdAt: 'asc' } },
          expenses: { include: { shares: true }, orderBy: { date: 'desc' } },
          settlements: { orderBy: { date: 'desc' } },
        }
      : undefined,
  });
  if (!group) throw new ApiError(404, 'Group not found');
  return group;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Shapes a full group into the client payload: expenses get their payer's name,
// members get computed balances, and the minimal settle-up plan is attached.
const presentGroup = (group) => {
  const nameById = new Map(group.members.map((m) => [m.id, m.name]));
  const balances = computeBalances(group);
  const you = group.members.find((m) => m.isYou);
  const yourBalance = balances.find((b) => b.memberId === you?.id)?.net ?? 0;

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    createdAt: group.createdAt,
    members: group.members,
    expenses: group.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      date: e.date,
      paidById: e.paidById,
      paidByName: nameById.get(e.paidById) ?? 'Unknown',
      shares: e.shares,
    })),
    settlements: group.settlements.map((s) => ({
      ...s,
      fromName: nameById.get(s.fromId) ?? 'Unknown',
      toName: nameById.get(s.toId) ?? 'Unknown',
    })),
    balances,
    settleUp: simplifyDebts(balances),
    totalSpent: round2(group.expenses.reduce((sum, e) => sum + e.amount, 0)),
    yourBalance,
  };
};

// GET /api/split/groups
export const listGroups = asyncHandler(async (req, res) => {
  const groups = await prisma.splitGroup.findMany({
    where: { ownerId: req.user.id },
    include: {
      members: true,
      expenses: { include: { shares: true } },
      settlements: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const summary = groups.map((g) => {
    const balances = computeBalances(g);
    const you = g.members.find((m) => m.isYou);
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      createdAt: g.createdAt,
      memberCount: g.members.length,
      expenseCount: g.expenses.length,
      totalSpent: round2(g.expenses.reduce((sum, e) => sum + e.amount, 0)),
      yourBalance: balances.find((b) => b.memberId === you?.id)?.net ?? 0,
    };
  });

  return ok(res, { groups: summary });
});

// POST /api/split/groups
export const createGroup = asyncHandler(async (req, res) => {
  const { name, emoji, members } = req.body;
  const memberNames = ['You', ...members.filter((n) => n.trim().toLowerCase() !== 'you')];

  const group = await prisma.splitGroup.create({
    data: {
      ownerId: req.user.id,
      name,
      emoji,
      members: {
        create: memberNames.map((n, i) => ({ name: n, isYou: i === 0 })),
      },
    },
    include: { members: true, expenses: { include: { shares: true } }, settlements: true },
  });

  writeAuditLog({ req, action: 'split.group.create', resource: 'splitGroup', resourceId: group.id });
  return created(res, { group: presentGroup(group) }, 'Group created');
});

// GET /api/split/groups/:id
export const getGroup = asyncHandler(async (req, res) => {
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  return ok(res, { group: presentGroup(group) });
});

// PUT /api/split/groups/:id
export const updateGroup = asyncHandler(async (req, res) => {
  await loadOwnedGroup(req.params.id, req.user.id);
  await prisma.splitGroup.update({ where: { id: req.params.id }, data: req.body });
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.group.update', resource: 'splitGroup', resourceId: group.id });
  return ok(res, { group: presentGroup(group) }, 'Group updated');
});

// DELETE /api/split/groups/:id
export const deleteGroup = asyncHandler(async (req, res) => {
  await loadOwnedGroup(req.params.id, req.user.id);
  await prisma.splitGroup.delete({ where: { id: req.params.id } });
  writeAuditLog({ req, action: 'split.group.delete', resource: 'splitGroup', resourceId: req.params.id });
  return ok(res, null, 'Group deleted');
});

// POST /api/split/groups/:id/members
export const addMember = asyncHandler(async (req, res) => {
  await loadOwnedGroup(req.params.id, req.user.id);
  await prisma.splitMember.create({
    data: { groupId: req.params.id, name: req.body.name, email: req.body.email || null },
  });
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.member.add', resource: 'splitGroup', resourceId: req.params.id });
  return created(res, { group: presentGroup(group) }, 'Member added');
});

// DELETE /api/split/groups/:id/members/:memberId
export const removeMember = asyncHandler(async (req, res) => {
  await loadOwnedGroup(req.params.id, req.user.id);
  const member = await prisma.splitMember.findFirst({
    where: { id: req.params.memberId, groupId: req.params.id },
  });
  if (!member) throw new ApiError(404, 'Member not found');
  if (member.isYou) throw new ApiError(400, 'You cannot remove yourself from the group');

  // Members referenced by expenses or settlements can't be removed — the history
  // would become inconsistent. Ask the user to delete those entries first.
  const [paid, shares, settlements] = await Promise.all([
    prisma.splitExpense.count({ where: { paidById: member.id } }),
    prisma.splitShare.count({ where: { memberId: member.id } }),
    prisma.settlement.count({
      where: { OR: [{ fromId: member.id }, { toId: member.id }] },
    }),
  ]);
  if (paid + shares + settlements > 0) {
    throw new ApiError(400, 'This member has expenses or settlements. Remove those first.');
  }

  await prisma.splitMember.delete({ where: { id: member.id } });
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.member.remove', resource: 'splitGroup', resourceId: req.params.id });
  return ok(res, { group: presentGroup(group) }, 'Member removed');
});

// POST /api/split/groups/:id/expenses
export const createExpense = asyncHandler(async (req, res) => {
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  const memberIds = new Set(group.members.map((m) => m.id));
  const { description, amount, paidById, date, splits } = req.body;

  if (!memberIds.has(paidById)) throw new ApiError(400, 'Payer is not a member of this group');

  let shares;
  if (splits) {
    for (const s of splits) {
      if (!memberIds.has(s.memberId)) throw new ApiError(400, 'A split refers to an unknown member');
    }
    const total = Math.round(splits.reduce((sum, s) => sum + s.amount, 0) * 100);
    if (total !== Math.round(amount * 100)) {
      throw new ApiError(400, 'Split shares must add up to the total amount');
    }
    shares = splits.filter((s) => s.amount > 0);
  } else {
    shares = equalSplits(amount, group.members.map((m) => m.id));
  }

  await prisma.splitExpense.create({
    data: {
      groupId: group.id,
      description,
      amount,
      paidById,
      date,
      shares: { create: shares.map((s) => ({ memberId: s.memberId, amount: s.amount })) },
    },
  });

  const fresh = await loadOwnedGroup(group.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.expense.create', resource: 'splitGroup', resourceId: group.id });
  return created(res, { group: presentGroup(fresh) }, 'Expense added');
});

// DELETE /api/split/groups/:id/expenses/:expenseId
export const deleteExpense = asyncHandler(async (req, res) => {
  await loadOwnedGroup(req.params.id, req.user.id);
  const expense = await prisma.splitExpense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.id },
    select: { id: true },
  });
  if (!expense) throw new ApiError(404, 'Expense not found');

  await prisma.splitExpense.delete({ where: { id: expense.id } });
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.expense.delete', resource: 'splitGroup', resourceId: req.params.id });
  return ok(res, { group: presentGroup(group) }, 'Expense deleted');
});

// POST /api/split/groups/:id/settlements
export const createSettlement = asyncHandler(async (req, res) => {
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  const memberIds = new Set(group.members.map((m) => m.id));
  const { fromId, toId, amount, date } = req.body;

  if (!memberIds.has(fromId) || !memberIds.has(toId)) {
    throw new ApiError(400, 'Settlement refers to an unknown member');
  }

  await prisma.settlement.create({
    data: { groupId: group.id, fromId, toId, amount, date },
  });

  const fresh = await loadOwnedGroup(group.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.settlement.create', resource: 'splitGroup', resourceId: group.id });
  return created(res, { group: presentGroup(fresh) }, 'Settlement recorded');
});

// DELETE /api/split/groups/:id/settlements/:settlementId
export const deleteSettlement = asyncHandler(async (req, res) => {
  await loadOwnedGroup(req.params.id, req.user.id);
  const settlement = await prisma.settlement.findFirst({
    where: { id: req.params.settlementId, groupId: req.params.id },
    select: { id: true },
  });
  if (!settlement) throw new ApiError(404, 'Settlement not found');

  await prisma.settlement.delete({ where: { id: settlement.id } });
  const group = await loadOwnedGroup(req.params.id, req.user.id, true);
  writeAuditLog({ req, action: 'split.settlement.delete', resource: 'splitGroup', resourceId: req.params.id });
  return ok(res, { group: presentGroup(group) }, 'Settlement deleted');
});
