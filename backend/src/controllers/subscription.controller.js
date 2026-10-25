import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';

// Normalises any billing cycle to an approximate monthly cost for totals.
const monthlyEquivalent = (amount, cycle) => {
  if (cycle === 'yearly') return amount / 12;
  if (cycle === 'quarterly') return amount / 3;
  return amount;
};

// GET /api/subscriptions
export const listSubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: req.user.id },
    orderBy: { nextBillingDate: 'asc' },
  });

  const monthlyTotal = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billingCycle), 0);

  return ok(res, { subscriptions, monthlyTotal: Math.round(monthlyTotal) });
});

// POST /api/subscriptions
export const createSubscription = asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.create({
    data: { ...req.body, userId: req.user.id },
  });
  writeAuditLog({
    req,
    action: 'subscription.create',
    resource: 'subscription',
    resourceId: subscription.id,
  });
  return created(res, { subscription }, 'Subscription added');
});

// PUT /api/subscriptions/:id
export const updateSubscription = asyncHandler(async (req, res) => {
  const existing = await prisma.subscription.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Subscription not found');

  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: req.body,
  });
  writeAuditLog({
    req,
    action: 'subscription.update',
    resource: 'subscription',
    resourceId: subscription.id,
  });
  return ok(res, { subscription }, 'Subscription updated');
});

// DELETE /api/subscriptions/:id
export const deleteSubscription = asyncHandler(async (req, res) => {
  const existing = await prisma.subscription.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Subscription not found');

  await prisma.subscription.delete({ where: { id: req.params.id } });
  writeAuditLog({
    req,
    action: 'subscription.delete',
    resource: 'subscription',
    resourceId: req.params.id,
  });
  return ok(res, null, 'Subscription removed');
});

// GET /api/subscriptions/upcoming?days=30 — active renewals in the window.
export const upcomingSubscriptions = asyncHandler(async (req, res) => {
  const days = req.query.days ?? 30;
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId: req.user.id,
      isActive: true,
      nextBillingDate: { lte: until },
    },
    orderBy: { nextBillingDate: 'asc' },
  });

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  return ok(res, { days, total, subscriptions });
});
