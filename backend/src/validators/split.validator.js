import Joi from 'joi';

// ── Groups ────────────────────────────────────────────────────────────────
export const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  emoji: Joi.string().trim().max(8).default('👥'),
  // Optional initial member names (besides "You", which is added automatically).
  members: Joi.array().items(Joi.string().trim().min(1).max(60)).max(50).default([]),
});

export const updateGroupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60),
  emoji: Joi.string().trim().max(8),
}).min(1);

// ── Members ───────────────────────────────────────────────────────────────
export const addMemberSchema = Joi.object({
  name: Joi.string().trim().min(1).max(60).required(),
  email: Joi.string().trim().email().max(120).allow(null, ''),
});

// ── Expenses ──────────────────────────────────────────────────────────────
// splits is optional: when omitted the amount is divided equally among all
// group members. When provided, it must list explicit per-member shares.
export const createSplitExpenseSchema = Joi.object({
  description: Joi.string().trim().min(1).max(120).required(),
  amount: Joi.number().positive().precision(2).max(100_000_000).required(),
  paidById: Joi.string().trim().min(1).max(40).required(),
  date: Joi.date().iso().default(() => new Date()),
  splits: Joi.array()
    .items(
      Joi.object({
        memberId: Joi.string().trim().min(1).max(40).required(),
        amount: Joi.number().min(0).precision(2).required(),
      })
    )
    .min(1),
});

// ── Route params ──────────────────────────────────────────────────────────
// `validate` strips unknown keys, so nested routes need every param declared.
const cuid = Joi.string().trim().min(1).max(40).required();

export const memberParamSchema = Joi.object({ id: cuid, memberId: cuid });
export const expenseParamSchema = Joi.object({ id: cuid, expenseId: cuid });
export const settlementParamSchema = Joi.object({ id: cuid, settlementId: cuid });

// ── Settlements ───────────────────────────────────────────────────────────
export const createSettlementSchema = Joi.object({
  fromId: Joi.string().trim().min(1).max(40).required(),
  toId: Joi.string().trim().min(1).max(40).invalid(Joi.ref('fromId')).required(),
  amount: Joi.number().positive().precision(2).required(),
  date: Joi.date().iso().default(() => new Date()),
});
