// Indian income-tax estimation for FY 2024-25. Deliberately simple — it feeds
// the AI tax advisor with ground-truth numbers rather than replacing a CA.

const NEW_REGIME_SLABS = [
  { upTo: 300000, rate: 0 },
  { upTo: 700000, rate: 0.05 },
  { upTo: 1000000, rate: 0.1 },
  { upTo: 1200000, rate: 0.15 },
  { upTo: 1500000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

const OLD_REGIME_SLABS = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

const STANDARD_DEDUCTION = { new: 75000, old: 50000 };
const CESS = 0.04; // 4% health & education cess

// Applies progressive slabs to a taxable amount.
const applySlabs = (taxable, slabs) => {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of slabs) {
    if (taxable <= lower) break;
    const band = Math.min(taxable, upTo) - lower;
    tax += band * rate;
    lower = upTo;
  }
  return tax;
};

// 87A rebate: no tax if taxable income is within the regime's rebate ceiling.
const applyRebate = (taxable, tax, regime) => {
  const ceiling = regime === 'new' ? 700000 : 500000;
  return taxable <= ceiling ? 0 : tax;
};

export const estimateTax = ({ annualIncome = 0, regime = 'new', deductions = 0 }) => {
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const std = STANDARD_DEDUCTION[regime] ?? 0;
  // Old regime allows 80C/80D etc.; new regime ignores them (only std deduction).
  const applicableDeductions = regime === 'old' ? deductions : 0;
  const taxable = Math.max(0, annualIncome - std - applicableDeductions);

  const base = applyRebate(taxable, applySlabs(taxable, slabs), regime);
  const total = Math.round(base * (1 + CESS));
  return { regime, taxableIncome: taxable, tax: total };
};

// Computes both regimes so the advisor can recommend the cheaper one.
export const compareRegimes = ({ annualIncome = 0, deductions = 0 }) => {
  const oldR = estimateTax({ annualIncome, regime: 'old', deductions });
  const newR = estimateTax({ annualIncome, regime: 'new', deductions: 0 });
  return {
    old: oldR.tax,
    new: newR.tax,
    recommended: newR.tax <= oldR.tax ? 'new' : 'old',
  };
};
