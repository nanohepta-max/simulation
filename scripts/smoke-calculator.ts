/**
 * Calculation smoke test — validates equal-payment, rate-switch, and term-shortening prepayment behavior.
 */
import { calculateLoan, calculatePortfolio, Loan } from "../client/src/lib/loan-calculator";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`検証失敗: ${message}`);
}

const standard: Loan = {
  id: "standard",
  name: "標準ケース",
  principal: 1_000_000,
  annualRate: 2,
  termMonths: 120,
  startMonth: "2026-01",
  rateChanges: [],
  prepayments: [],
};
const standardResult = calculateLoan(standard);
assert(standardResult.schedule.length === 120, "繰上返済なしでは設定した返済期間になる");
assert(Math.abs(standardResult.schedule.at(-1)?.balance ?? 1) < 0.01, "最終残高がゼロになる");

const switched: Loan = { ...standard, id: "switched", rateChanges: [{ id: "rate-1", month: 25, annualRate: 3.5 }] };
const switchedResult = calculateLoan(switched);
assert(switchedResult.schedule[24].annualRate === 3.5, "指定月から新しい金利を適用する");
assert(switchedResult.schedule.length === 120, "金利切替後も当初の返済期間を維持する");

const prepaid: Loan = { ...standard, id: "prepaid", prepayments: [{ id: "prepay-1", month: 24, amount: 150_000 }] };
const prepaidResult = calculateLoan(prepaid);
assert(prepaidResult.schedule.length < standardResult.schedule.length, "繰上返済で返済期間を短縮する");
assert(prepaidResult.totalInterest < standardResult.totalInterest, "繰上返済で利息を削減する");

const portfolio = calculatePortfolio([standard, prepaid]);
assert(portfolio.interestSaved > 0, "ポートフォリオで繰上返済の利息削減を集計する");
console.log("計算スモークテスト: OK", { standardMonths: standardResult.schedule.length, prepaidMonths: prepaidResult.schedule.length, savedInterest: Math.round(portfolio.interestSaved) });
