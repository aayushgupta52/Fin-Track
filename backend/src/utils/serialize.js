// Strips sensitive fields before sending a user object to the client.
export const publicUser = (user) => {
  if (!user) return null;
  const { passwordHash, googleId, panNumber, ...safe } = user;
  return safe;
};

// PostgreSQL stores Expense.tags as a native String[] and AuditLog.details as
// native Json, so no boundary conversion is needed. These remain as thin
// pass-throughs to keep call sites stable.
export const serializeExpenseInput = (data) => data;

export const parseExpense = (expense) => expense;
