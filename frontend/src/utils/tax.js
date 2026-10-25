// Mirror of backend/src/utils/taxCalculator.js for instant, offline regime
// comparison on the Tax Planner page (FY 2024-25).

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
const CESS = 0.04;

const applySlabs = (taxable, slabs) => {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of slabs) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upTo) - lower) * rate;
    lower = upTo;
  }
  return tax;
};

const applyRebate = (taxable, tax, regime) => {
  const ceiling = regime === 'new' ? 700000 : 500000;
  return taxable <= ceiling ? 0 : tax;
};

export const estimateTax = ({ annualIncome = 0, regime = 'new', deductions = 0 }) => {
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const std = STANDARD_DEDUCTION[regime] ?? 0;
  const applicable = regime === 'old' ? deductions : 0;
  const taxable = Math.max(0, annualIncome - std - applicable);
  const base = applyRebate(taxable, applySlabs(taxable, slabs), regime);
  return { regime, taxableIncome: taxable, tax: Math.round(base * (1 + CESS)) };
};

export const compareRegimes = ({ annualIncome = 0, deductions = 0 }) => {
  const oldR = estimateTax({ annualIncome, regime: 'old', deductions });
  const newR = estimateTax({ annualIncome, regime: 'new', deductions: 0 });
  return {
    old: oldR.tax,
    new: newR.tax,
    oldTaxable: oldR.taxableIncome,
    newTaxable: newR.taxableIncome,
    recommended: newR.tax <= oldR.tax ? 'new' : 'old',
    savings: Math.abs(oldR.tax - newR.tax),
  };
};
