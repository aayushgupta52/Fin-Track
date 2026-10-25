// India-specific expense taxonomy and shared enums.
// Kept in one place so validators, AI categorization, and the frontend agree.

export const EXPENSE_CATEGORIES = {
  Food: ['Zomato', 'Swiggy', 'Restaurant', 'Chai', 'Groceries'],
  Transport: ['Ola', 'Uber', 'Metro', 'Petrol', 'Rapido', 'Bus'],
  Shopping: ['Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Mall'],
  Entertainment: ['Netflix', 'Hotstar', 'Movies', 'Games', 'YouTube Premium'],
  Healthcare: ['Pharmacy', 'Doctor', 'Hospital', 'Lab Tests', 'Insurance Premium'],
  Education: ['Udemy', 'Coursera', 'Books', 'College Fee', 'Tuition'],
  EMI: ['Home Loan', 'Car Loan', 'Personal Loan', 'Credit Card EMI'],
  Rent: ['House Rent', 'PG Rent'],
  Utilities: ['Electricity', 'Water', 'Internet', 'Mobile Recharge', 'Gas'],
  Investment: ['Zerodha', 'Groww', 'Kuvera', 'PPF', 'FD', 'Gold'],
  Insurance: ['LIC', 'Term Insurance', 'Health Insurance', 'Vehicle Insurance'],
  Grocery: ['BigBasket', 'Blinkit', 'Zepto', 'DMart', 'Local Kirana'],
  PersonalCare: ['Salon', 'Gym', 'Parlour', 'Skincare'],
  Travel: ['Flight', 'Hotel', 'Train', 'IRCTC', 'MakeMyTrip'],
  Subscription: ['Amazon Prime', 'Spotify', 'LinkedIn Premium'],
  Transfer: ['Family', 'Friend', 'EMI Transfer'],
  Other: ['Miscellaneous'],
};

export const CATEGORY_NAMES = Object.keys(EXPENSE_CATEGORIES);

export const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'NetBanking', 'Unknown'];

export const EXPENSE_SOURCES = ['manual', 'ocr', 'pdf', 'sms'];

export const TAX_SECTIONS = ['80C', '80D', '80E', '80CCD', '80G', 'HRA', '24B'];

export const INCOME_SOURCES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Rental',
  'Other',
];
