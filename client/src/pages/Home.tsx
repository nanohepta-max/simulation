/**
 * Calm Operations Desk — the primary workspace pairs a fixed planning rail with a results horizon.
 * Keep the visual language: ink navy, paper neutrals, precise ledger lines, and focused actions.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BadgeJapaneseYen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  FileDown,
  FileUp,
  Flag,
  Landmark,
  LineChart,
  ListPlus,
  Minus,
  Plus,
  Printer,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateLoan,
  calculatePortfolio,
  createLoan,
  Loan,
  monthShort,
  num,
  Prepayment,
  RateChange,
  sampleLoans,
  yen,
} from "@/lib/loan-calculator";

type SavedPlan = { id: string; name: string; savedAt: string; loans: Loan[] };
const STORAGE_KEY = "loan-repayment-simulator-current-v1";
const SAVED_KEY = "loan-repayment-simulator-saved-v1";

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const numeric = (value: string) => (value === "" ? 0 : Number(value));

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function IconButton({ label, children, onClick, danger = false }: { label: string; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition duration-150 active:scale-[.97] ${danger ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-slate-200 text-slate-600 hover:border-[#15304A]/30 hover:bg-slate-50 hover:text-[#15304A]"}`}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, detail, tone = "navy", icon }: { label: string; value: string; detail: string; tone?: "navy" | "sage" | "terracotta"; icon: React.ReactNode }) {
  const colors = {
    navy: "bg-[#15304A] text-white",
    sage: "bg-[#E6EFE8] text-[#265B43]",
    terracotta: "bg-[#F8E5DF] text-[#99432E]",
  };
  return (
    <section className="metric-card relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_36px_-28px_rgba(21,48,74,.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">{label}</p>
          <p className="mt-2 font-plex text-xl font-bold tracking-[-.04em] text-[#15304A] tabular-nums">{value}</p>
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </section>
  );
}

function EmptyWorkspace({ onSample, onAdd }: { onSample: () => void; onAdd: () => void }) {
  return (
    <div className="empty-horizon relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[url('/manus-storage/annual-timeline-texture_785745c7.jpg')] bg-cover bg-center opacity-[.11]" />
      <div className="empty-horizon-rules pointer-events-none absolute inset-0" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="relative grid min-h-60 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="max-w-xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6EFE8] text-[#265B43]"><Landmark size={21} /></div>
          <p className="mt-5 eyebrow">返済開始点を記録</p>
          <h2 className="mt-2 font-plex text-xl font-bold tracking-[-.045em] text-[#15304A]">借入条件から、返済の時間軸をつくります</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">元本・金利・返済期間を追加すると、月々の返済額、金利切替の影響、完済までの見通しを同じ時間軸で確認できます。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={onAdd} className="action-primary"><Plus size={17} />借入を追加</button>
            <button onClick={onSample} className="action-secondary"><ClipboardCheck size={16} />入力例を試す</button>
          </div>
        </div>
        <div className="empty-horizon-legend self-end lg:self-center"><div className="flex items-center justify-between text-[10px] font-bold tracking-[.1em] text-slate-400"><span>開始</span><span>完済</span></div><div className="relative mt-3 h-11 border-l border-b border-slate-300"><span className="absolute bottom-0 left-0 h-px w-[72%] bg-[#15304A]" /><span className="absolute bottom-0 left-[28%] h-3 w-1 rounded-full bg-[#B35C45]" /><span className="absolute bottom-[-4px] left-[56%] h-2.5 w-2.5 rotate-45 bg-[#B6D0BC]" /><span className="absolute bottom-0 left-[72%] h-1.5 w-1.5 rounded-full bg-[#15304A]" /></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span>金利切替</span><span>繰上返済</span><span>残高推移</span></div></div>
      </div>
    </div>
  );
}

export default function Home() {
  const [loans, setLoans] = useState<Loan[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Loan[]; } catch { return []; }
  });
  const [selectedId, setSelectedId] = useState<string>(() => loans[0]?.id ?? "");
  const [editorTab, setEditorTab] = useState<"base" | "rates" | "prepayments">("base");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]") as SavedPlan[]; } catch { return []; }
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const portfolio = useMemo(() => calculatePortfolio(loans), [loans]);
  const selectedLoan = loans.find((loan) => loan.id === selectedId) ?? loans[0];
  const selectedResult = useMemo(() => selectedLoan ? calculateLoan(selectedLoan) : undefined, [selectedLoan]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loans));
    if (!selectedId && loans[0]) setSelectedId(loans[0].id);
  }, [loans, selectedId]);

  const updateLoan = (changes: Partial<Loan>) => {
    if (!selectedLoan) return;
    setLoans((current) => current.map((loan) => loan.id === selectedLoan.id ? { ...loan, ...changes } : loan));
  };
  const addLoan = () => {
    const next = createLoan();
    setLoans((current) => [...current, next]);
    setSelectedId(next.id);
    setEditorTab("base");
  };
  const removeLoan = (id: string) => {
    const target = loans.find((loan) => loan.id === id);
    if (!target || !confirm(`「${target.name}」を削除しますか？`)) return;
    setLoans((current) => current.filter((loan) => loan.id !== id));
    if (selectedId === id) setSelectedId(loans.find((loan) => loan.id !== id)?.id ?? "");
    toast.success("借入を削除しました");
  };
  const savePlan = () => {
    const name = saveName.trim() || `返済計画 ${new Date().toLocaleDateString("ja-JP")}`;
    const next: SavedPlan = { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), loans };
    const updated = [next, ...savedPlans].slice(0, 30);
    setSavedPlans(updated); localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    setSaveName(""); setIsSaveOpen(false); toast.success(`「${name}」を端末に保存しました`);
  };
  const loadPlan = (plan: SavedPlan) => {
    setLoans(plan.loans); setSelectedId(plan.loans[0]?.id ?? ""); setIsPlansOpen(false); toast.success(`「${plan.name}」を読み込みました`);
  };
  const deletePlan = (id: string) => {
    const updated = savedPlans.filter((plan) => plan.id !== id);
    setSavedPlans(updated); localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  };
  const exportJson = () => downloadFile(`loan-plan-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), loans }, null, 2), "application/json");
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { loans?: Loan[] };
      if (!Array.isArray(parsed.loans)) throw new Error("invalid");
      setLoans(parsed.loans); setSelectedId(parsed.loans[0]?.id ?? ""); toast.success("計画ファイルを読み込みました");
    } catch { toast.error("読み込めませんでした。対応する計画ファイルを選んでください。"); }
    if (fileInput.current) fileInput.current.value = "";
  };
  const exportCsv = () => {
    const header = ["借入名", "回数", "年月", "適用年利(%)", "通常返済額", "利息", "元金返済", "繰上返済", "返済後残高"];
    const rows = portfolio.results.flatMap((result) => result.schedule.map((row) => [result.loan.name, row.month, row.date, row.annualRate.toFixed(3), Math.round(row.payment), Math.round(row.interest), Math.round(row.principalPayment), Math.round(row.prepayment), Math.round(row.balance)]));
    downloadFile(`loan-schedule-${new Date().toISOString().slice(0, 10)}.csv`, "\uFEFF" + [header, ...rows].map((row) => row.map((cell) => `\"${String(cell).replaceAll('\"', '\"\"')}\"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <div className="min-h-screen bg-[#F7F7F3] text-slate-800 selection:bg-[#D9E7DE]">
      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importJson(event.target.files?.[0])} />
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-[#F7F7F3]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/manus-storage/loan-line-logo_05d84022.png" alt="返済計画" className="h-10 w-10 object-contain" />
            <div><p className="font-plex text-[15px] font-bold tracking-[-.045em] text-[#15304A]">返済計画</p><p className="mt-0.5 text-[10px] font-semibold tracking-[.14em] text-slate-400">LOAN PLANNER</p></div>
          </div>
          <div className="hidden items-center gap-2 md:flex"><span className="status-dot" /><span className="text-xs text-slate-500">この端末に自動保存中</span></div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => setIsPlansOpen(true)} className="header-action"><Clock3 size={16} /><span className="hidden sm:inline">保存済み</span></button>
            <button onClick={() => setIsSaveOpen(true)} className="header-action"><Save size={16} /><span className="hidden sm:inline">保存</span></button>
            <button onClick={exportJson} className="header-action" title="計画をJSONで書き出し"><Download size={16} /><span className="hidden lg:inline">書き出し</span></button>
            <button onClick={() => fileInput.current?.click()} className="header-action" title="JSON計画を読み込み"><Upload size={16} /><span className="hidden lg:inline">読込</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:py-7">
        <section className="relative mb-5 overflow-hidden rounded-2xl border border-[#15304A]/10 bg-[#EBEEEA] px-5 py-5 sm:px-7 sm:py-6">
          <div className="absolute inset-0 bg-[url('/manus-storage/ledger-hero-paper_f1e84de0.jpg')] bg-cover bg-center opacity-45" />
          <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div className="max-w-2xl"><div className="eyebrow">返済の全体像</div><h1 className="mt-2 font-plex text-2xl font-bold tracking-[-.055em] text-[#15304A] sm:text-3xl">いまの条件で、完済までを見通す。</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">複数の借入、金利の切替、繰上返済を月単位で反映します。変更すると結果はすぐに更新されます。</p></div>
            <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur-sm"><p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">返済方式</p><p className="mt-1 text-sm font-semibold text-[#15304A]">元利均等・期間短縮型の繰上返済</p></div>
          </div>
        </section>

        <div className="workspace-grid grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
          <aside className="workbench-rail no-print h-fit xl:sticky xl:top-[76px]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(21,48,74,.45)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><p className="text-[11px] font-semibold tracking-[.1em] text-slate-500">借入一覧</p><p className="mt-1 font-plex text-lg font-bold tracking-[-.04em] text-[#15304A]">返済計画の操縦桿</p></div><IconButton label="借入を追加" onClick={addLoan}><Plus size={18} /></IconButton></div>
              <div className="max-h-[36vh] overflow-y-auto p-2">
                {loans.length === 0 ? <p className="px-3 py-7 text-center text-sm text-slate-400">借入がありません</p> : loans.map((loan, index) => {
                  const result = calculateLoan(loan);
                  const selected = loan.id === selectedLoan?.id;
                  return <button key={loan.id} onClick={() => { setSelectedId(loan.id); setEditorTab("base"); }} className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selected ? "bg-[#15304A] text-white shadow-lg shadow-[#15304A]/15" : "hover:bg-slate-50"}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? "bg-white/15" : index % 2 ? "bg-[#F8E5DF] text-[#99432E]" : "bg-[#E6EFE8] text-[#265B43]"}`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{loan.name || "名称未設定"}</span><span className={`mt-1 block text-xs tabular-nums ${selected ? "text-white/65" : "text-slate-500"}`}>{loan.principal > 0 ? yen(loan.principal) : "金額を入力"} ・ {result.payoffDate}</span></span>
                    <ChevronDown className={`h-4 w-4 transition ${selected ? "rotate-[-90deg] text-white/70" : "-rotate-90 text-slate-300"}`} />
                  </button>;
                })}
              </div>
              <div className="border-t border-slate-100 p-3"><button onClick={addLoan} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-[#15304A]/30 hover:bg-[#F7F7F3] hover:text-[#15304A]"><ListPlus size={16} />借入を追加</button></div>
            </section>

            <section className="mt-4 overflow-hidden rounded-2xl bg-[#15304A] p-4 text-white">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold tracking-[.12em] text-white/60">繰上返済の効果</p><p className="mt-2 font-plex text-xl font-bold tracking-[-.05em] tabular-nums">{yen(portfolio.interestSaved)}</p></div><ArrowUpRight className="text-[#B6D0BC]" size={20} /></div>
              <p className="mt-2 text-xs leading-5 text-white/65">支払利息の削減見込み。追加返済がない条件と比較しています。</p>
              {portfolio.totalPrepayment > 0 && <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/70">繰上返済合計 <span className="float-right font-semibold tabular-nums text-white">{yen(portfolio.totalPrepayment)}</span></div>}
            </section>
          </aside>

          <div className="min-w-0 space-y-5">
            {loans.length === 0 ? <EmptyWorkspace onAdd={addLoan} onSample={() => { const sample = sampleLoans(); setLoans(sample); setSelectedId(sample[0].id); toast.success("入力例を読み込みました"); }} /> : <>
              <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <Metric label="借入元本の合計" value={yen(portfolio.currentPrincipal)} detail={`${loans.length}件の借入を集計`} icon={<WalletCards size={16} />} />
                <Metric label="初月の返済額" value={yen(portfolio.nextPayment)} detail="金利切替・繰上返済前の通常返済" tone="sage" icon={<BadgeJapaneseYen size={16} />} />
                <Metric label="支払利息の見込み" value={yen(portfolio.totalInterest)} detail="現在の設定から試算" icon={<LineChart size={16} />} />
                <Metric label="最終完済予定" value={portfolio.payoffDate} detail={portfolio.monthsShortened > 0 ? `繰上返済で ${portfolio.monthsShortened}か月短縮` : "繰上返済を加えると短縮できます"} tone={portfolio.monthsShortened > 0 ? "terracotta" : "navy"} icon={<Flag size={16} />} />
              </section>

              {selectedLoan && <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(21,48,74,.45)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6EFE8] text-[#265B43]"><Settings2 size={18} /></span><div><p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">条件を調整</p><h2 className="font-plex text-lg font-bold tracking-[-.04em] text-[#15304A]">{selectedLoan.name || "借入条件"}</h2></div></div>
                  <div className="flex items-center gap-2"><button onClick={() => removeLoan(selectedLoan.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"><Trash2 size={15} />削除</button></div>
                </div>
                <div className="no-print flex overflow-x-auto border-b border-slate-100 px-4 sm:px-5">
                  {([ ["base", "基本条件", SlidersHorizontal], ["rates", "金利切替", LineChart], ["prepayments", "繰上返済", ArrowDownToLine] ] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setEditorTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${editorTab === id ? "border-[#15304A] text-[#15304A]" : "border-transparent text-slate-500 hover:text-slate-700"}`}><Icon size={15} />{label}{id === "rates" && selectedLoan.rateChanges.length > 0 && <span className="rounded-full bg-[#E6EFE8] px-1.5 text-[10px] text-[#265B43]">{selectedLoan.rateChanges.length}</span>}{id === "prepayments" && selectedLoan.prepayments.length > 0 && <span className="rounded-full bg-[#F8E5DF] px-1.5 text-[10px] text-[#99432E]">{selectedLoan.prepayments.length}</span>}</button>)}
                </div>
                <div className="p-4 sm:p-5">
                  {editorTab === "base" && <BaseEditor loan={selectedLoan} onChange={updateLoan} onResetSample={() => { const next = sampleLoans()[0]; setLoans((current) => current.map((loan) => loan.id === selectedLoan.id ? { ...next, id: loan.id } : loan)); toast.success("入力例を反映しました"); }} />}
                  {editorTab === "rates" && <RateEditor loan={selectedLoan} onChange={updateLoan} />}
                  {editorTab === "prepayments" && <PrepaymentEditor loan={selectedLoan} onChange={updateLoan} />}
                </div>
              </section>}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(21,48,74,.45)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">返済の見通し</p><h2 className="mt-1 font-plex text-lg font-bold tracking-[-.04em] text-[#15304A]">残高とイベントの時間軸</h2></div><div className="flex gap-2"><button onClick={() => setIsScheduleOpen(!isScheduleOpen)} className="action-secondary text-xs">{isScheduleOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{isScheduleOpen ? "予定表を閉じる" : "予定表を開く"}</button><button onClick={exportCsv} className="action-secondary text-xs"><FileDown size={15} />CSV</button><button onClick={() => window.print()} className="action-secondary text-xs"><Printer size={15} />印刷</button></div></div>
                <PortfolioTimeline loans={loans} />
                {selectedResult && <LoanSummary result={selectedResult} />}
                {isScheduleOpen && selectedResult && <ScheduleTable loan={selectedLoan} schedule={selectedResult.schedule} />}
              </section>
            </>}
          </div>
        </div>

        <p className="no-print mt-5 px-1 text-xs leading-5 text-slate-500"><CircleHelp className="mr-1 inline h-3.5 w-3.5" />本ツールは概算です。実際の返済額・利息計算・金利適用時期は金融機関の契約条件をご確認ください。金利切替時は、残りの当初返済期間に対して月々の返済額を再計算します。繰上返済は各月の通常返済後に元本へ充当する「期間短縮型」として計算します。</p>
      </main>

      {isSaveOpen && <Modal title="この計画を保存" onClose={() => setIsSaveOpen(false)}><p className="text-sm leading-6 text-slate-600">現在の借入・金利切替・繰上返済の条件を、このブラウザの端末内に保存します。</p><label className="mt-5 block"><span className="field-label">計画名</span><input autoFocus value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="例：2026年 夏の繰上返済案" className="field-input mt-1.5" /></label><div className="mt-6 flex justify-end gap-2"><button onClick={() => setIsSaveOpen(false)} className="action-secondary">キャンセル</button><button onClick={savePlan} className="action-primary"><Save size={16} />保存する</button></div></Modal>}
      {isPlansOpen && <Modal title="保存済みの計画" onClose={() => setIsPlansOpen(false)}><div className="mb-4 rounded-xl bg-[#F7F7F3] p-3 text-xs leading-5 text-slate-600">保存先はこの端末のブラウザ内です。端末間で移す場合は、上部の「書き出し」「読込」を使ってください。</div>{savedPlans.length === 0 ? <div className="py-10 text-center text-sm text-slate-400">保存済みの計画はありません</div> : <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">{savedPlans.map((plan) => <div key={plan.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6EFE8] text-[#265B43]"><CalendarDays size={15} /></span><button onClick={() => loadPlan(plan)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-[#15304A]">{plan.name}</p><p className="mt-0.5 text-xs text-slate-500">{formatDateTime(plan.savedAt)} ・ {plan.loans.length}件</p></button><IconButton danger label="保存済み計画を削除" onClick={() => deletePlan(plan.id)}><Trash2 size={15} /></IconButton></div>)}</div>}<div className="mt-5 flex justify-end"><button onClick={() => setIsPlansOpen(false)} className="action-primary"><Check size={16} />閉じる</button></div></Modal>}
    </div>
  );
}

function BaseEditor({ loan, onChange, onResetSample }: { loan: Loan; onChange: (changes: Partial<Loan>) => void; onResetSample: () => void }) {
  return <div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="借入名"><input value={loan.name} onChange={(event) => onChange({ name: event.target.value })} className="field-input" placeholder="例：住宅ローン" /></Field><Field label="借入元本" suffix="円"><input type="number" min="0" step="10000" value={loan.principal || ""} onChange={(event) => onChange({ principal: numeric(event.target.value) })} className="field-input" placeholder="32000000" /></Field><Field label="年利" suffix="%"><input type="number" min="0" step="0.01" value={loan.annualRate || ""} onChange={(event) => onChange({ annualRate: numeric(event.target.value) })} className="field-input" placeholder="0.65" /></Field><Field label="返済開始月"><input type="month" value={loan.startMonth} onChange={(event) => onChange({ startMonth: event.target.value })} className="field-input" /></Field><Field label="返済期間" suffix="か月"><input type="number" min="1" max="600" value={loan.termMonths || ""} onChange={(event) => onChange({ termMonths: Math.max(1, numeric(event.target.value)) })} className="field-input" placeholder="420" /></Field><div className="sm:col-span-2 lg:col-span-3"><div className="h-full rounded-xl border border-[#15304A]/10 bg-[#F7F7F3] px-4 py-3"><p className="text-xs font-semibold text-[#15304A]">計算の前提</p><p className="mt-1 text-xs leading-5 text-slate-500">毎月返済額は元利均等返済です。金利切替月には、残る当初期間で返済できるように毎月返済額を再計算します。繰上返済後は通常返済額を維持し、完済時期を早めます。</p></div></div></div><div className="mt-4 flex justify-end"><button onClick={onResetSample} className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-[#15304A]">この借入に入力例を適用</button></div></div>;
}

function RateEditor({ loan, onChange }: { loan: Loan; onChange: (changes: Partial<Loan>) => void }) {
  const events = [...loan.rateChanges].sort((a, b) => a.month - b.month);
  const update = (id: string, changes: Partial<RateChange>) => onChange({ rateChanges: loan.rateChanges.map((event) => event.id === id ? { ...event, ...changes } : event) });
  return <div><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#15304A]">金利の切替予定</p><p className="mt-1 text-xs leading-5 text-slate-500">変更月の返済開始時点から新しい年利を反映します。</p></div><button onClick={() => onChange({ rateChanges: [...loan.rateChanges, { id: crypto.randomUUID(), month: Math.max(2, Math.min(loan.termMonths, 13)), annualRate: loan.annualRate }] })} className="action-primary self-start text-xs"><Plus size={15} />金利切替を追加</button></div><div className="mt-4 overflow-hidden rounded-xl border border-slate-200">{events.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-400">金利切替の予定はありません</div> : events.map((event, index) => <div key={event.id} className="grid gap-3 border-b border-slate-100 p-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] sm:items-end"><Field label="適用する回数"><div className="relative"><input type="number" min="1" max={loan.termMonths} value={event.month} onChange={(e) => update(event.id, { month: Math.max(1, Math.min(loan.termMonths, numeric(e.target.value))) })} className="field-input pr-12" /><span className="absolute right-3 top-2.5 text-xs text-slate-400">回目</span></div><p className="mt-1 text-[11px] text-slate-400">{monthShort(loan.startMonth, event.month - 1)}</p></Field><Field label="切替後の年利"><div className="relative"><input type="number" min="0" step="0.01" value={event.annualRate} onChange={(e) => update(event.id, { annualRate: numeric(e.target.value) })} className="field-input pr-8" /><span className="absolute right-3 top-2.5 text-xs text-slate-400">%</span></div></Field><IconButton danger label={`金利切替 ${index + 1} を削除`} onClick={() => onChange({ rateChanges: loan.rateChanges.filter((item) => item.id !== event.id) })}><Trash2 size={15} /></IconButton></div>)}</div></div>;
}

function PrepaymentEditor({ loan, onChange }: { loan: Loan; onChange: (changes: Partial<Loan>) => void }) {
  const events = [...loan.prepayments].sort((a, b) => a.month - b.month);
  const update = (id: string, changes: Partial<Prepayment>) => onChange({ prepayments: loan.prepayments.map((event) => event.id === id ? { ...event, ...changes } : event) });
  return <div><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#15304A]">繰上返済の予定</p><p className="mt-1 text-xs leading-5 text-slate-500">通常返済の後に元本へ充当し、月々の返済額を維持して返済期間を短縮します。</p></div><button onClick={() => onChange({ prepayments: [...loan.prepayments, { id: crypto.randomUUID(), month: Math.max(1, Math.min(loan.termMonths, 12)), amount: 100000, note: "" }] })} className="action-primary self-start text-xs"><Plus size={15} />繰上返済を追加</button></div><div className="mt-4 overflow-hidden rounded-xl border border-slate-200">{events.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-400">繰上返済の予定はありません</div> : events.map((event, index) => <div key={event.id} className="grid gap-3 border-b border-slate-100 p-3 last:border-0 sm:grid-cols-[.7fr_1fr_1fr_36px] sm:items-end"><Field label="返済回数"><div className="relative"><input type="number" min="1" max={loan.termMonths} value={event.month} onChange={(e) => update(event.id, { month: Math.max(1, Math.min(loan.termMonths, numeric(e.target.value))) })} className="field-input pr-12" /><span className="absolute right-3 top-2.5 text-xs text-slate-400">回目</span></div><p className="mt-1 text-[11px] text-slate-400">{monthShort(loan.startMonth, event.month - 1)}</p></Field><Field label="繰上返済額" suffix="円"><input type="number" min="0" step="10000" value={event.amount || ""} onChange={(e) => update(event.id, { amount: numeric(e.target.value) })} className="field-input" /></Field><Field label="メモ（任意）"><input value={event.note || ""} onChange={(e) => update(event.id, { note: e.target.value })} className="field-input" placeholder="例：賞与から" /></Field><IconButton danger label={`繰上返済 ${index + 1} を削除`} onClick={() => onChange({ prepayments: loan.prepayments.filter((item) => item.id !== event.id) })}><Trash2 size={15} /></IconButton></div>)}</div></div>;
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) { return <label className="block"><span className="field-label">{label}{suffix && <span className="ml-1 font-normal text-slate-400">（{suffix}）</span>}</span><div className="mt-1.5">{children}</div></label>; }

function PortfolioTimeline({ loans }: { loans: Loan[] }) {
  const results = loans.filter((loan) => loan.principal > 0 && loan.termMonths > 0).map((loan) => calculateLoan(loan));
  const maximum = Math.max(1, ...results.map((result) => result.payoffMonth));
  const palette = ["#15304A", "#527A64", "#B35C45", "#64748B", "#8A7298"];
  if (results.length === 0) return <div className="p-5 text-sm text-slate-400">条件を入力すると、返済の時間軸を表示します。</div>;
  return <div className="p-4 sm:p-5"><div className="rounded-xl bg-[#F7F7F3] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-[#15304A]">完済までの進行線</p><p className="mt-1 text-xs text-slate-500">各借入の返済期間とイベント位置</p></div><span className="text-xs font-semibold tabular-nums text-slate-500">最長 {maximum}か月</span></div><div className="space-y-4">{results.map((result, index) => { const color = palette[index % palette.length]; const rateChanges = result.loan.rateChanges; const prepayments = result.loan.prepayments; return <div key={result.loan.id}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-700">{result.loan.name}</span><span className="shrink-0 tabular-nums text-slate-500">{result.payoffDate}</span></div><div className="relative h-4 rounded-full bg-slate-200/80"><div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, (result.payoffMonth / maximum) * 100)}%`, backgroundColor: color }} />{rateChanges.map((event) => <span key={event.id} title={`${monthShort(result.loan.startMonth, event.month - 1)}：年利 ${event.annualRate}%`} className="absolute top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-[#B35C45] ring-2 ring-[#F7F7F3]" style={{ left: `${Math.min(99, (event.month / maximum) * 100)}%` }} />)}{prepayments.map((event) => <span key={event.id} title={`${monthShort(result.loan.startMonth, event.month - 1)}：${yen(event.amount)} を繰上返済`} className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-[#C1D4C6] ring-2 ring-[#F7F7F3]" style={{ left: `${Math.min(98, (event.month / maximum) * 100)}%` }} />)}</div></div>; })}</div><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#15304A]" />返済期間</span><span className="inline-flex items-center gap-1.5"><i className="h-3 w-1 rounded-full bg-[#B35C45]" />金利切替</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rotate-45 bg-[#C1D4C6]" />繰上返済</span></div></div></div>;
}

function LoanSummary({ result }: { result: ReturnType<typeof calculateLoan> }) { return <div className="grid border-t border-slate-100 sm:grid-cols-3"><div className="border-b border-slate-100 p-4 sm:border-b-0 sm:border-r"><p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">この借入の初月返済額</p><p className="mt-2 font-plex text-xl font-bold tracking-[-.04em] text-[#15304A] tabular-nums">{yen(result.initialPayment)}</p></div><div className="border-b border-slate-100 p-4 sm:border-b-0 sm:border-r"><p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">この借入の支払利息</p><p className="mt-2 font-plex text-xl font-bold tracking-[-.04em] text-[#15304A] tabular-nums">{yen(result.totalInterest)}</p></div><div className="p-4"><p className="text-[11px] font-semibold tracking-[.08em] text-slate-500">完済予定</p><p className="mt-2 font-plex text-xl font-bold tracking-[-.04em] text-[#15304A] tabular-nums">{result.payoffDate}</p></div></div>; }

function ScheduleTable({ loan, schedule }: { loan: Loan; schedule: ReturnType<typeof calculateLoan>["schedule"] }) { const [visible, setVisible] = useState(24); const shown = schedule.slice(0, visible); return <div className="border-t border-slate-100"><div className="flex items-center justify-between bg-[#F7F7F3] px-4 py-3 sm:px-5"><div><p className="text-sm font-semibold text-[#15304A]">{loan.name} の返済予定表</p><p className="mt-0.5 text-xs text-slate-500">返済予定は概算です。イベント月を含めて月次で表示します。</p></div><span className="text-xs text-slate-500">{schedule.length}回</span></div><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-right text-xs"><thead className="bg-white text-slate-500"><tr><th className="px-4 py-3 text-left font-semibold">回数</th><th className="px-3 py-3 text-left font-semibold">年月</th><th className="px-3 py-3 font-semibold">年利</th><th className="px-3 py-3 font-semibold">通常返済</th><th className="px-3 py-3 font-semibold">利息</th><th className="px-3 py-3 font-semibold">元金返済</th><th className="px-3 py-3 font-semibold">繰上返済</th><th className="px-4 py-3 font-semibold">返済後残高</th></tr></thead><tbody>{shown.map((row) => <tr key={row.month} className={`border-t border-slate-100 ${row.prepayment > 0 || loan.rateChanges.some((event) => event.month === row.month) ? "bg-[#FBFBF7]" : ""}`}><td className="px-4 py-3 text-left font-medium text-slate-700">{row.month}</td><td className="px-3 py-3 text-left text-slate-600">{row.date}</td><td className="px-3 py-3 tabular-nums">{row.annualRate.toFixed(3)}%</td><td className="px-3 py-3 tabular-nums">{yen(row.payment)}</td><td className="px-3 py-3 tabular-nums text-[#99432E]">{yen(row.interest)}</td><td className="px-3 py-3 tabular-nums text-[#265B43]">{yen(row.principalPayment)}</td><td className="px-3 py-3 tabular-nums font-semibold text-[#265B43]">{row.prepayment > 0 ? yen(row.prepayment) : "—"}</td><td className="px-4 py-3 tabular-nums font-semibold text-[#15304A]">{yen(row.balance)}</td></tr>)}</tbody></table></div>{visible < schedule.length && <div className="p-4 text-center"><button onClick={() => setVisible((count) => Math.min(schedule.length, count + 24))} className="action-secondary text-xs">さらに24か月表示 <ChevronDown size={15} /></button></div>}</div>; }

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="no-print fixed inset-0 z-50 flex items-end bg-slate-950/30 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center"><section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-plex text-xl font-bold tracking-[-.04em] text-[#15304A]">{title}</h2><IconButton label="閉じる" onClick={onClose}><X size={18} /></IconButton></div>{children}</section></div>; }
