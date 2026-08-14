/**
 * Calm Operations Desk — calculation kernel.
 * Each rate change recalculates the regular payment against the remaining original term.
 * Prepayments are applied after the regular monthly payment and shorten the repayment period.
 */

export type RateChange = { id: string; month: number; annualRate: number };
export type Prepayment = { id: string; month: number; amount: number; note?: string };
export type Loan = {
  id: string;
  name: string;
  principal: number;
  annualRate: number;
  termMonths: number;
  startMonth: string;
  rateChanges: RateChange[];
  prepayments: Prepayment[];
};

export type ScheduleRow = {
  month: number;
  date: string;
  annualRate: number;
  payment: number;
  interest: number;
  principalPayment: number;
  prepayment: number;
  balance: number;
};

export type LoanResult = {
  loan: Loan;
  schedule: ScheduleRow[];
  totalPayment: number;
  totalInterest: number;
  totalPrepayment: number;
  payoffMonth: number;
  payoffDate: string;
  initialPayment: number;
};

export const yen = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);

export const num = (value: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );

export const monthLabel = (isoMonth: string, offset = 0) => {
  const [year, month] = (isoMonth || "2026-01").split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + offset, 1);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};

export const monthShort = (isoMonth: string, offset = 0) => {
  const [year, month] = (isoMonth || "2026-01").split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + offset, 1);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function paymentFor(balance: number, annualRate: number, months: number) {
  if (balance <= 0 || months <= 0) return 0;
  const rate = Math.max(0, annualRate) / 100 / 12;
  if (rate === 0) return balance / months;
  const factor = (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
  return balance * factor;
}

export function calculateLoan(loan: Loan, ignorePrepayments = false): LoanResult {
  const rateChanges = [...loan.rateChanges].sort((a, b) => a.month - b.month);
  const prepayments = [...loan.prepayments].sort((a, b) => a.month - b.month);
  const schedule: ScheduleRow[] = [];
  let balance = Math.max(0, loan.principal || 0);
  let rate = Math.max(0, loan.annualRate || 0);
  let regularPayment = paymentFor(balance, rate, Math.max(1, loan.termMonths || 1));
  let rateIndex = 0;
  let totalInterest = 0;
  let totalPayment = 0;
  let totalPrepayment = 0;
  const safetyLimit = Math.max(loan.termMonths + 600, 720);

  for (let month = 1; month <= safetyLimit && balance > 0.01; month += 1) {
    while (rateIndex < rateChanges.length && rateChanges[rateIndex].month === month) {
      rate = Math.max(0, rateChanges[rateIndex].annualRate);
      regularPayment = paymentFor(balance, rate, Math.max(1, loan.termMonths - month + 1));
      rateIndex += 1;
    }

    const interest = balance * (rate / 100 / 12);
    const payment = Math.min(Math.max(0, regularPayment), balance + interest);
    const principalPayment = Math.max(0, payment - interest);
    balance = Math.max(0, balance - principalPayment);

    const plannedPrepayment = ignorePrepayments
      ? 0
      : prepayments
          .filter((event) => event.month === month)
          .reduce((total, event) => total + Math.max(0, event.amount), 0);
    const prepayment = Math.min(plannedPrepayment, balance);
    balance = Math.max(0, balance - prepayment);

    totalInterest += interest;
    totalPayment += payment + prepayment;
    totalPrepayment += prepayment;
    schedule.push({
      month,
      date: monthLabel(loan.startMonth, month - 1),
      annualRate: rate,
      payment,
      interest,
      principalPayment,
      prepayment,
      balance,
    });
  }

  const last = schedule.at(-1);
  return {
    loan,
    schedule,
    totalPayment,
    totalInterest,
    totalPrepayment,
    payoffMonth: last?.month ?? 0,
    payoffDate: last?.date ?? "—",
    initialPayment: schedule[0]?.payment ?? 0,
  };
}

export function calculatePortfolio(loans: Loan[]) {
  const results = loans
    .filter((loan) => loan.principal > 0 && loan.termMonths > 0)
    .map((loan) => calculateLoan(loan));
  const baseline = loans
    .filter((loan) => loan.principal > 0 && loan.termMonths > 0)
    .map((loan) => calculateLoan(loan, true));
  const currentPrincipal = loans.reduce((total, loan) => total + Math.max(0, loan.principal || 0), 0);
  const totalInterest = results.reduce((total, result) => total + result.totalInterest, 0);
  const totalPrepayment = results.reduce((total, result) => total + result.totalPrepayment, 0);
  const baselineInterest = baseline.reduce((total, result) => total + result.totalInterest, 0);
  const allSchedules = results.flatMap((result) => result.schedule);
  const maxMonth = Math.max(0, ...results.map((result) => result.payoffMonth));
  const finalResult = results.sort((a, b) => b.payoffMonth - a.payoffMonth)[0];

  return {
    results,
    currentPrincipal,
    totalInterest,
    totalPrepayment,
    interestSaved: Math.max(0, baselineInterest - totalInterest),
    monthsShortened: Math.max(0, Math.max(0, ...baseline.map((result) => result.payoffMonth)) - maxMonth),
    payoffDate: finalResult?.payoffDate ?? "—",
    nextPayment: results.reduce((total, result) => total + (result.schedule[0]?.payment ?? 0), 0),
    maxMonth,
    allSchedules,
  };
}

export function createLoan(): Loan {
  return {
    id: crypto.randomUUID(),
    name: "新しい借入",
    principal: 0,
    annualRate: 0,
    termMonths: 120,
    startMonth: new Date().toISOString().slice(0, 7),
    rateChanges: [],
    prepayments: [],
  };
}

export const sampleLoans = (): Loan[] => [
  {
    id: crypto.randomUUID(),
    name: "住宅ローン",
    principal: 32000000,
    annualRate: 0.65,
    termMonths: 420,
    startMonth: "2026-04",
    rateChanges: [{ id: crypto.randomUUID(), month: 25, annualRate: 1.05 }],
    prepayments: [{ id: crypto.randomUUID(), month: 60, amount: 500000, note: "賞与から" }],
  },
  {
    id: crypto.randomUUID(),
    name: "教育ローン",
    principal: 1800000,
    annualRate: 1.8,
    termMonths: 120,
    startMonth: "2026-04",
    rateChanges: [],
    prepayments: [{ id: crypto.randomUUID(), month: 24, amount: 100000, note: "臨時収入" }],
  },
];
