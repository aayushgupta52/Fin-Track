// Pure financial maths for the calculators page. No formatting here — callers
// format with formatINR so the numbers stay testable.

// Future value of a monthly SIP.
// FV = P * [((1+r)^n - 1) / r] * (1+r)   where r = monthly rate, n = months.
export const calculateSIP = (monthly, annualReturn, years) => {
  const r = annualReturn / 100 / 12;
  const n = years * 12;
  if (n <= 0) return { futureValue: 0, totalInvested: 0, gains: 0 };

  const totalInvested = monthly * n;
  // r === 0 degenerates to a plain sum of contributions.
  const futureValue =
    r === 0 ? totalInvested : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);

  return {
    futureValue: Math.round(futureValue),
    totalInvested: Math.round(totalInvested),
    gains: Math.round(futureValue - totalInvested),
  };
};

// EMI for a reducing-balance loan.
// EMI = P * r * (1+r)^n / ((1+r)^n - 1)
export const calculateEMI = (principal, annualRate, tenureMonths) => {
  const r = annualRate / 100 / 12;
  const n = tenureMonths;
  if (n <= 0) return { emi: 0, totalInterest: 0, totalPayment: 0 };

  const emi =
    r === 0
      ? principal / n
      : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = emi * n;

  return {
    emi: Math.round(emi),
    totalInterest: Math.round(totalPayment - principal),
    totalPayment: Math.round(totalPayment),
  };
};
