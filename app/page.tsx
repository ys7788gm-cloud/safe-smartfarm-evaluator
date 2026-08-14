"use client";

import { useEffect, useMemo, useState } from "react";
import { crops, prechecks, qualitativeItems } from "./model-data";

type SupportType = "일반 스마트팜" | "청년 스마트팜" | "수직농장" | "소규모 스마트팜";
type Answer = "예" | "아니오" | "해당없음" | "확인필요";
type ScenarioKey = "base" | "conservative" | "optimistic";
type FormState = {
  applicant: string; supportType: SupportType; crop: string; facility: string;
  area: number; cycles: number; revenueFactor: number; costFactor: number; floorArea: number; salesChannel: string;
  projectCost: number; facilityLoan: number; repairLoan: number; workingLoan: number; equity: number; grant: number;
  existingDebt: number; existingDebtYears: number; workingRate: number; ramp: number[];
  scenarios: Record<ScenarioKey, { revenue: number; cost: number }>;
};

const tabs = ["개요", "사전체크", "정성평가", "사업정보", "평가결과"];
const scenarioMeta: Record<ScenarioKey, { label: string; tone: string; note: string }> = {
  base: { label: "기준", tone: "base", note: "농산물소득조사 값 적용" },
  conservative: { label: "보수", tone: "down", note: "가격·수량 하락 및 비용 상승" },
  optimistic: { label: "낙관", tone: "up", note: "교육·운영역량 향상 가정" },
};

const sampleForm: FormState = {
  applicant: "박영수", supportType: "소규모 스마트팜", crop: "시설상추", facility: "유리온실",
  area: 1650, cycles: 4, revenueFactor: 1.1, costFactor: 1, floorArea: 0, salesChannel: "도매시장·계약재배",
  projectCost: 500, facilityLoan: 450, repairLoan: 0, workingLoan: 0, equity: 50, grant: 0,
  existingDebt: 0, existingDebtYears: 0, workingRate: 0.035, ramp: [0.7, 0.8, 0.9, 1, 1, 1],
  scenarios: { base: { revenue: 1, cost: 1 }, conservative: { revenue: 0.9, cost: 1.05 }, optimistic: { revenue: 1.1, cost: 1.05 } },
};

const answerOptions: Answer[] = ["예", "아니오", "해당없음", "확인필요"];
const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 });
const asNumber = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const gradeFor = (score: number) => score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";

function Field({ label, value, onChange, suffix, step = 1, min = 0, help }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: number; min?: number; help?: string }) {
  return <label className="field"><span className="field-label">{label}</span><span className="input-shell"><input type="number" value={value} min={min} step={step} onChange={(event) => onChange(asNumber(event.target.value))} />{suffix && <span>{suffix}</span>}</span>{help && <small>{help}</small>}</label>;
}

function Metric({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: string }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<FormState>(sampleForm);
  const [answers, setAnswers] = useState<Record<number, Answer>>(Object.fromEntries(prechecks.map((item) => [item.id, item.defaultAnswer as Answer])));
  const [scores, setScores] = useState<Record<number, number>>(Object.fromEntries(qualitativeItems.map((item) => [item.id, item.defaultScore])));
  const [passGrade, setPassGrade] = useState("B");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("safe-evaluation-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm(parsed.form);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.scores) setScores(parsed.scores);
        if (parsed.passGrade) setPassGrade(parsed.passGrade);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("safe-evaluation-v1", JSON.stringify({ form, answers, scores, passGrade })); } catch {}
  }, [form, answers, scores, passGrade, hydrated]);

  const qualitative = useMemo(() => {
    const total = qualitativeItems.reduce((sum, item) => sum + item.weight * (scores[item.id] ?? 0) / 4, 0);
    const grade = gradeFor(total);
    const threshold = passGrade === "A" ? 85 : passGrade === "B" ? 70 : 55;
    const groups = Array.from(new Set(qualitativeItems.map((item) => item.group))).map((group) => {
      const items = qualitativeItems.filter((item) => item.group === group);
      const possible = items.reduce((sum, item) => sum + item.weight, 0);
      const earned = items.reduce((sum, item) => sum + item.weight * (scores[item.id] ?? 0) / 4, 0);
      return { group, possible, earned, ratio: possible ? earned / possible : 0 };
    });
    return { total, grade, threshold, pass: total >= threshold, low: qualitativeItems.filter((item) => (scores[item.id] ?? 0) <= 1), groups };
  }, [scores, passGrade]);

  const precheck = useMemo(() => {
    const statuses = prechecks.map((item) => {
      const answer = answers[item.id] ?? "확인필요";
      const status = answer === "예" ? "완료" : answer === "해당없음" ? "해당없음" : answer === "아니오" ? (item.requirement === "필수" ? "필수 미충족" : "보완 필요") : "확인 필요";
      return { ...item, answer, status };
    });
    const required = statuses.filter((item) => item.status === "필수 미충족").length;
    const review = statuses.filter((item) => item.status === "확인 필요").length;
    const improve = statuses.filter((item) => item.status === "보완 필요").length;
    const complete = statuses.filter((item) => item.status === "완료" || item.status === "해당없음").length;
    return { statuses, required, review, improve, complete, ready: required + review + improve === 0 };
  }, [answers]);

  const result = useMemo(() => {
    const crop = crops.find((item) => item.name === form.crop) ?? crops[0];
    const scenarioValues = (Object.keys(scenarioMeta) as ScenarioKey[]).map((key) => {
      const adjustment = form.scenarios[key];
      const revenue = crop.revenue * form.area / 1_000_000 * form.cycles * form.revenueFactor * adjustment.revenue;
      const cost = crop.cost * form.area / 1_000_000 * form.cycles * form.costFactor * adjustment.cost;
      const income = revenue - cost;
      return { key, revenue, cost, income, margin: revenue ? income / revenue : 0 };
    });
    const ratio = form.supportType === "청년 스마트팜" ? (form.projectCost <= 1000 ? 1 : form.projectCost <= 1500 ? 0.95 : 0.9) : form.supportType === "수직농장" ? 0.8 : form.supportType === "소규모 스마트팜" ? 1 : 0.9;
    const personLimit = form.supportType === "청년 스마트팜" ? 3000 : form.supportType === "소규모 스마트팜" ? 500 : 5000;
    const projectLimit = form.projectCost * ratio;
    const facilitiesCombined = Math.max(0, form.facilityLoan) + Math.max(0, form.repairLoan);
    const fixedRate = form.supportType === "청년 스마트팜" || form.supportType === "소규모 스마트팜" ? 0.01 : facilitiesCombined <= 3000 ? 0.01 : 0.02;
    const workingSupported = form.supportType === "일반 스마트팜" || form.supportType === "청년 스마트팜";
    const facilityGrace = form.supportType === "소규모 스마트팜" ? 3 : 5;
    const facilityRepay = form.supportType === "소규모 스마트팜" ? 10 : 20;
    const repairGrace = form.repairLoan <= 0 ? 0 : form.repairLoan < 50 ? 2 : 3;
    const repairRepay = form.repairLoan <= 0 ? 0 : form.repairLoan < 50 ? 3 : form.repairLoan < 100 ? 5 : 7;
    const loans = [
      { name: "시설자금", requested: Math.max(0, form.facilityLoan), analyzed: Math.max(0, form.facilityLoan), supported: form.facilityLoan > 0, rate: fixedRate, grace: form.facilityLoan > 0 ? facilityGrace : 0, repay: form.facilityLoan > 0 ? facilityRepay : 0 },
      { name: "개보수자금", requested: Math.max(0, form.repairLoan), analyzed: Math.max(0, form.repairLoan), supported: form.repairLoan > 0, rate: form.repairLoan > 0 ? fixedRate : 0, grace: repairGrace, repay: repairRepay },
      { name: "운전자금", requested: Math.max(0, form.workingLoan), analyzed: workingSupported ? Math.max(0, form.workingLoan) : 0, supported: workingSupported && form.workingLoan > 0, rate: workingSupported && form.workingLoan > 0 ? form.workingRate : 0, grace: 0, repay: workingSupported && form.workingLoan > 0 ? 2 : 0 },
    ];
    const balances = loans.map((loan) => loan.analyzed);
    const schedule = Array.from({ length: 30 }, (_, index) => {
      const year = index + 1;
      const opening = [...balances];
      const principalByLoan = loans.map((loan, loanIndex) => {
        const principal = loan.repay > 0 && year > loan.grace && year <= loan.grace + loan.repay ? loan.analyzed / loan.repay : 0;
        balances[loanIndex] = Math.max(0, balances[loanIndex] - principal);
        return principal;
      });
      const principal = principalByLoan.reduce((sum, value) => sum + value, 0);
      const interest = opening.reduce((sum, value, loanIndex) => sum + value * loans[loanIndex].rate, 0);
      const existing = year <= form.existingDebtYears ? form.existingDebt : 0;
      const debt = principal + interest + existing;
      const utilization = form.ramp[Math.min(index, 5)] ?? 1;
      const remaining = Object.fromEntries(scenarioValues.map((scenario) => [scenario.key, scenario.income * utilization - debt])) as Record<ScenarioKey, number>;
      const period = principal > 0 ? "원금상환기간" : interest > 0 ? "거치기간" : "상환종료 후";
      return { year, period, utilization, principal, interest, existing, debt, remaining, closing: balances.reduce((sum, value) => sum + value, 0) };
    });
    const summaries = scenarioValues.map((scenario) => {
      const graceRows = schedule.filter((row) => row.period === "거치기간");
      const repayRows = schedule.filter((row) => row.period === "원금상환기간");
      const afterRows = schedule.filter((row) => row.period === "상환종료 후");
      const all = schedule.map((row) => row.remaining[scenario.key]);
      return { ...scenario, graceAverage: average(graceRows.map((row) => row.remaining[scenario.key])), repayAverage: average(repayRows.map((row) => row.remaining[scenario.key])), afterAverage: average(afterRows.map((row) => row.remaining[scenario.key])), cumulative: all.reduce((sum, value) => sum + value, 0), minimum: Math.min(...all) };
    });
    const totalRequested = loans.reduce((sum, loan) => sum + loan.requested, 0);
    const totalAnalyzed = loans.reduce((sum, loan) => sum + loan.analyzed, 0);
    const fundingDifference = form.facilityLoan + form.repairLoan + form.workingLoan + form.equity + form.grant - form.projectCost;
    const checks = [
      { label: "선택 품목 존재", ok: crops.some((item) => item.name === form.crop), note: "품목 DB" },
      { label: "재배면적 양수", ok: form.area > 0, note: "사업정보" },
      { label: "총 조달액과 총사업비 일치", ok: Math.abs(fundingDifference) <= 0.01, note: `차이 ${money.format(fundingDifference)}백만원` },
      { label: "시설·개보수 신청액이 사업비 한도 이내", ok: facilitiesCombined <= projectLimit + 0.01, note: `한도 ${money.format(projectLimit)}백만원` },
      { label: "정책자금 신청액이 동일인 한도 이내", ok: totalRequested <= personLimit + 0.01, note: `한도 ${integer.format(personLimit)}백만원` },
      { label: "운전자금 지원유형 적합", ok: form.workingLoan <= 0 || workingSupported, note: workingSupported ? "지원유형" : "일반·청년만 지원" },
      { label: "수직농장 보정근거 입력", ok: form.supportType !== "수직농장" || form.revenueFactor !== 1 || form.costFactor !== 1, note: "매출·비용 보정" },
      { label: "시나리오 계수 양수", ok: Object.values(form.scenarios).every((scenario) => scenario.revenue > 0 && scenario.cost > 0), note: "시나리오 가정" },
    ];
    return { crop, scenarioValues, loans, schedule, summaries, ratio, personLimit, projectLimit, totalRequested, totalAnalyzed, fundingDifference, checks, allChecksPass: checks.every((check) => check.ok) };
  }, [form]);

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) { setForm((current) => ({ ...current, [key]: value })); }
  function loadExample() {
    setForm(sampleForm);
    setAnswers(Object.fromEntries(prechecks.map((item) => [item.id, item.defaultAnswer as Answer])));
    setScores(Object.fromEntries(qualitativeItems.map((item) => [item.id, item.defaultScore])));
    setPassGrade("B"); setActiveTab(0);
  }

  const completedTabs = [true, precheck.ready, qualitative.pass, result.allChecksPass, result.allChecksPass];
  const selectedSummary = result.summaries[0];
  const chartValues = result.schedule.flatMap((row) => [row.remaining.base, row.remaining.conservative, row.remaining.optimistic, 0]);
  const chartMin = Math.min(...chartValues), chartMax = Math.max(...chartValues), chartRange = chartMax - chartMin || 1;
  const points = (key: ScenarioKey) => result.schedule.map((row, index) => `${24 + index * (852 / 29)},${220 - ((row.remaining[key] - chartMin) / chartRange) * 180}`).join(" ");
  const zeroY = 220 - ((0 - chartMin) / chartRange) * 180;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" onClick={() => setActiveTab(0)} aria-label="SAFE 홈">
          <span className="brand-mark">S</span>
          <span><strong>SAFE</strong><small>Smart Agriculture Feasibility Evaluation</small></span>
        </a>
        <div className="header-actions"><span className="autosave"><i /> 이 기기에 자동 저장</span><button className="button ghost compact" onClick={loadExample}>예시값 복원</button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">SAFE · VERSION 1.0 · 2026.08.13</span>
          <h1>스마트팜 사업의<br /><em>실행 가능성</em>을 숫자로 확인하세요.</h1>
          <p>사전 준비부터 정성평가, 품목별 소득과 정책자금 상환 전망까지. 복잡한 엑셀 모델을 누구나 사용할 수 있는 단계형 평가 도구로 옮겼습니다.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => { setActiveTab(1); document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }); }}>평가 시작하기 <span>→</span></button>
            <button className="button text" onClick={() => { setActiveTab(4); document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }); }}>예시 결과 보기</button>
          </div>
          <div className="hero-proof"><span><strong>51</strong>개 품목 데이터</span><span><strong>30</strong>년 상환 전망</span><span><strong>3</strong>개 시나리오</span></div>
        </div>
        <aside className="hero-panel" aria-label="현재 예시 요약">
          <div className="panel-top"><span>현재 평가 요약</span><span className="live-pill">LIVE</span></div>
          <div className="mini-farm"><div className="sun" /><div className="greenhouse"><i /><i /><i /><b /><b /><b /><b /></div><div className="field-lines"><i /><i /><i /></div></div>
          <div className="hero-kpis">
            <div><span>선택 품목</span><strong>{form.crop}</strong></div>
            <div><span>정상 예상소득</span><strong>{money.format(selectedSummary.income)}<small> 백만원/년</small></strong></div>
            <div><span>정성평가</span><strong>{qualitative.total.toFixed(1)}점 · {qualitative.grade}등급</strong></div>
          </div>
          <p className="panel-note">입력값을 바꾸면 모든 금액이 즉시 다시 계산됩니다.</p>
        </aside>
      </section>

      <section className="notice-band"><strong>중요 안내</strong><p>본 모델은 상담·사업계획 검토를 위한 참고도구입니다. 투자 적정/부적정이나 대출 승인 여부를 자동 판정하지 않으며, 실제 지원액·금리·상환능력은 관계기관의 별도 심사를 따릅니다.</p></section>

      <section className="workspace" id="workspace">
        <nav className="step-nav" aria-label="평가 단계">
          {tabs.map((tab, index) => <button key={tab} className={activeTab === index ? "active" : ""} onClick={() => setActiveTab(index)} aria-current={activeTab === index ? "step" : undefined}><span>{completedTabs[index] ? "✓" : index + 1}</span>{tab}</button>)}
        </nav>

        {activeTab === 0 && (
          <div className="page-section overview-page">
            <div className="section-heading"><span className="section-kicker">평가 흐름</span><h2>5단계로 빠르게 확인합니다</h2><p>노란 입력칸을 찾아 헤맬 필요 없이, 화면이 필요한 순서대로 안내합니다.</p></div>
            <div className="flow-grid">
              {[["01", "사전체크", "자격·부지·증빙 준비상태", "상담 가능 여부"], ["02", "정성평가", "20개 실행가능성 항목", "점수·등급·보완사항"], ["03", "사업정보", "품목·면적·보정·자금", "정책조건 자동 연결"], ["04", "30년 전망", "소득·원금·이자", "연도별 잔여소득"], ["05", "결과 검토", "기준·보수·낙관 비교", "금액 중심 의사결정"]].map(([number, title, input, output]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{input}</p><small>{output}</small></article>)}
            </div>
            <div className="method-grid">
              <article className="method-card dark"><span>핵심 산식</span><h3>농산물소득조사 × 실제 사업조건</h3><ol><li><i>01</i><div><strong>정상연도 총수입</strong><p>10a당 총수입 × 면적 × 작기 × 매출보정</p></div></li><li><i>02</i><div><strong>정상연도 경영비</strong><p>10a당 경영비 × 면적 × 작기 × 비용보정</p></div></li><li><i>03</i><div><strong>상환 후 잔여소득</strong><p>예상소득 × 가동률 − 신규 원리금 − 기존 원리금</p></div></li></ol></article>
              <article className="method-card source-card"><span>자료 기준</span><h3>공공자료로 계산 근거를 투명하게</h3><div className="source-line"><b>RDA · 2024</b><p>농촌진흥청 농산물소득조사<br />51개 품목 · 1년 1기작 · 10a 기준</p></div><div className="source-line"><b>MAFRA · 2026</b><p>농업자금이차보전 사업시행지침<br />금리 · 거치 · 상환 · 지원한도</p></div><a href="https://www.rda.go.kr/board/board.do?dataNo=100000805467&mode=view&prgId=day_farmprmninfoEntry" target="_blank" rel="noreferrer">농촌진흥청 원자료 확인 ↗</a></article>
            </div>
            <div className="next-bar"><p><strong>준비되셨나요?</strong> 입력 내용은 브라우저에 자동 저장됩니다.</p><button className="button primary" onClick={() => setActiveTab(1)}>사전체크 시작 →</button></div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="page-section">
            <div className="section-heading split-heading"><div><span className="section-kicker">1단계 · 사전 준비</span><h2>상담 전 준비상태 점검</h2><p>각 항목의 현재 상태를 선택하세요. 필수 미충족·확인 필요·보완 필요 항목이 없으면 ‘상담 가능’으로 표시됩니다.</p></div><div className={`status-card ${precheck.ready ? "success" : "warning"}`}><span>상담준비 상태</span><strong>{precheck.ready ? "상담 가능" : "보완 필요"}</strong><small>{precheck.complete}/28 항목 완료</small></div></div>
            <div className="summary-strip four"><Metric label="필수 미충족" value={`${precheck.required}`} tone={precheck.required ? "danger" : "good"} /><Metric label="확인 필요" value={`${precheck.review}`} tone={precheck.review ? "warn" : "good"} /><Metric label="보완 필요" value={`${precheck.improve}`} tone={precheck.improve ? "warn" : "good"} /><Metric label="완료·해당없음" value={`${precheck.complete} / 28`} /></div>
            {Array.from(new Set(prechecks.map((item) => item.group))).map((group) => (
              <section className="check-group" key={group}>
                <h3>{group}<span>{precheck.statuses.filter((item) => item.group === group && (item.status === "완료" || item.status === "해당없음")).length}/{prechecks.filter((item) => item.group === group).length}</span></h3>
                {precheck.statuses.filter((item) => item.group === group).map((item) => <article className="check-row" key={item.id}><div className="check-copy"><span>{String(item.id).padStart(2, "0")}</span><div><h4>{item.title}<b className={`requirement ${item.requirement === "필수" ? "required" : ""}`}>{item.requirement}</b></h4><p>{item.criterion}</p></div></div><div className="answer-set" role="group" aria-label={`${item.title} 응답`}>{answerOptions.map((answer) => <button key={answer} className={item.answer === answer ? "selected" : ""} onClick={() => setAnswers((current) => ({ ...current, [item.id]: answer }))}>{answer}</button>)}</div><span className={`row-status ${item.status.replaceAll(" ", "-")}`}>{item.status}</span></article>)}
              </section>
            ))}
            <div className="next-bar"><p><strong>{precheck.ready ? "사전체크를 완료했습니다." : "보완이 필요한 항목을 확인하세요."}</strong> ‘상담 가능’은 대출 승인이나 지원대상 확정을 의미하지 않습니다.</p><button className="button primary" onClick={() => setActiveTab(2)}>정성평가로 →</button></div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="page-section">
            <div className="section-heading split-heading"><div><span className="section-kicker">2단계 · 실행가능성</span><h2>SAFE 정성평가</h2><p>확인자료를 근거로 0~4점을 선택하세요. 근거가 없으면 구두설명만으로 3점 이상을 부여하지 않는 것이 원칙입니다.</p></div><div className={`score-ring grade-${qualitative.grade.toLowerCase()}`}><span>{qualitative.total.toFixed(1)}</span><small>100점</small><b>{qualitative.grade}</b></div></div>
            <div className="score-toolbar"><label>통과기준 등급<select value={passGrade} onChange={(event) => setPassGrade(event.target.value)}><option>A</option><option>B</option><option>C</option></select></label><span className={qualitative.pass ? "pass" : "hold"}>{qualitative.pass ? "기준 통과" : "기준 미달"} · 통과점수 {qualitative.threshold}점</span><span>중점보완 {qualitative.low.length}개</span></div>
            <div className="category-bars">{qualitative.groups.map((group) => <div key={group.group}><span><b>{group.group}</b><em>{group.earned.toFixed(1)} / {group.possible}</em></span><i><b style={{ width: `${group.ratio * 100}%` }} /></i></div>)}</div>
            <div className="qual-list">
              {qualitativeItems.map((item) => { const score = scores[item.id] ?? 0; return <article className="qual-card" key={item.id}><div className="qual-main"><span className="item-number">{String(item.id).padStart(2, "0")}</span><div><small>{item.group}</small><h3>{item.title}</h3><p>확인자료: {item.evidence}</p></div><strong>{(item.weight * score / 4).toFixed(2)}<small> / {item.weight}점</small></strong></div><div className="score-buttons" role="group" aria-label={`${item.title} 평점`}>{[0, 1, 2, 3, 4].map((value) => <button key={value} onClick={() => setScores((current) => ({ ...current, [item.id]: value }))} className={score === value ? "selected" : ""}><b>{value}</b><span>{value === 4 ? "우수" : value === 3 ? "양호" : value === 2 ? "보완" : value === 1 ? "미흡" : "근거없음"}</span></button>)}</div><details><summary>현재 {score}점 판단기준 보기</summary><p>{item.criteria[String(score) as keyof typeof item.criteria]}</p></details></article>; })}
            </div>
            <div className="next-bar"><p><strong>{qualitative.total.toFixed(1)}점 · {qualitative.grade}등급</strong> 낮은 점수의 항목은 보완자료 제출 후 재평가할 수 있습니다.</p><button className="button primary" onClick={() => setActiveTab(3)}>사업정보 입력 →</button></div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="page-section">
            <div className="section-heading"><span className="section-kicker">3단계 · 정량 입력</span><h2>사업정보와 자금계획</h2><p>금액은 백만원, 면적은 실제 작물이 재배되는 ㎡ 기준으로 입력하세요. 수직농장은 다단 재배면적 합계와 보정근거를 별도로 검토해야 합니다.</p></div>
            <div className="form-section"><h3><span>01</span>신청자·사업 기본정보</h3><div className="form-grid four-col">
              <label className="field"><span className="field-label">신청기업/예정자명</span><input type="text" value={form.applicant} onChange={(event) => updateForm("applicant", event.target.value)} /></label>
              <label className="field"><span className="field-label">지원유형</span><select value={form.supportType} onChange={(event) => updateForm("supportType", event.target.value as SupportType)}>{["일반 스마트팜", "청년 스마트팜", "수직농장", "소규모 스마트팜"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="field"><span className="field-label">선택 품목</span><select value={form.crop} onChange={(event) => updateForm("crop", event.target.value)}>{Array.from(new Set(crops.map((item) => item.category))).map((category) => <optgroup label={category} key={category}>{crops.filter((item) => item.category === category).map((crop) => <option key={crop.name}>{crop.name}</option>)}</optgroup>)}</select></label>
              <label className="field"><span className="field-label">시설 형태</span><select value={form.facility} onChange={(event) => updateForm("facility", event.target.value)}><option>유리온실</option><option>연동형 비닐온실</option><option>단동형 비닐온실</option><option>수직농장</option><option>기타</option></select></label>
              <Field label="적용 재배면적" value={form.area} onChange={(value) => updateForm("area", value)} suffix="㎡" /><Field label="연간 작기 반영계수" value={form.cycles} onChange={(value) => updateForm("cycles", value)} suffix="회" step={0.1} /><Field label="시설 매출 보정계수" value={form.revenueFactor} onChange={(value) => updateForm("revenueFactor", value)} suffix="배" step={0.05} /><Field label="시설 비용 보정계수" value={form.costFactor} onChange={(value) => updateForm("costFactor", value)} suffix="배" step={0.05} /><Field label="수직농장 바닥면적" value={form.floorArea} onChange={(value) => updateForm("floorArea", value)} suffix="㎡" />
              <label className="field span-2"><span className="field-label">주요 판매처/채널</span><input type="text" value={form.salesChannel} onChange={(event) => updateForm("salesChannel", event.target.value)} /></label>
            </div>{form.supportType === "수직농장" && form.revenueFactor === 1 && form.costFactor === 1 && <p className="inline-warning">수직농장은 전용 소득자료가 없으므로 전력비·다단면적·작기 근거를 반영한 매출/비용 보정계수를 입력하세요.</p>}</div>
            <div className="form-section"><h3><span>02</span>시나리오 가정</h3><div className="scenario-inputs">{(Object.keys(scenarioMeta) as ScenarioKey[]).map((key) => <article key={key}><div><span className={`dot ${scenarioMeta[key].tone}`} /><strong>{scenarioMeta[key].label}</strong><small>{scenarioMeta[key].note}</small></div><Field label="매출 조정" value={form.scenarios[key].revenue * 100} onChange={(value) => setForm((current) => ({ ...current, scenarios: { ...current.scenarios, [key]: { ...current.scenarios[key], revenue: value / 100 } } }))} suffix="%" /><Field label="경영비 조정" value={form.scenarios[key].cost * 100} onChange={(value) => setForm((current) => ({ ...current, scenarios: { ...current.scenarios, [key]: { ...current.scenarios[key], cost: value / 100 } } }))} suffix="%" /></article>)}</div></div>
            <div className="form-section"><h3><span>03</span>투자 및 자금조달 <small>금액 단위: 백만원</small></h3><div className="form-grid four-col"><Field label="총 사업비" value={form.projectCost} onChange={(value) => updateForm("projectCost", value)} suffix="백만원" /><Field label="시설자금 신청액" value={form.facilityLoan} onChange={(value) => updateForm("facilityLoan", value)} suffix="백만원" /><Field label="개보수자금 신청액" value={form.repairLoan} onChange={(value) => updateForm("repairLoan", value)} suffix="백만원" /><Field label="운전자금 신청액" value={form.workingLoan} onChange={(value) => updateForm("workingLoan", value)} suffix="백만원" /><Field label="자기자금" value={form.equity} onChange={(value) => updateForm("equity", value)} suffix="백만원" /><Field label="보조금·출연금" value={form.grant} onChange={(value) => updateForm("grant", value)} suffix="백만원" /><Field label="기존 연간 원리금" value={form.existingDebt} onChange={(value) => updateForm("existingDebt", value)} suffix="백만원" /><Field label="기존 원리금 잔여연수" value={form.existingDebtYears} onChange={(value) => updateForm("existingDebtYears", value)} suffix="년" /><Field label="운전자금 적용금리" value={form.workingRate * 100} onChange={(value) => updateForm("workingRate", value / 100)} suffix="%" step={0.1} /></div><div className={`funding-balance ${Math.abs(result.fundingDifference) <= 0.01 ? "balanced" : "unbalanced"}`}><span>총 조달액 − 총 사업비</span><strong>{money.format(result.fundingDifference)} 백만원</strong><small>{Math.abs(result.fundingDifference) <= 0.01 ? "자금조달 합계가 일치합니다." : "자기자금·보조금·신청액을 확인하세요."}</small></div></div>
            <div className="form-section"><h3><span>04</span>초기 가동률</h3><div className="ramp-grid">{form.ramp.map((value, index) => <Field key={index} label={index < 5 ? `${index + 1}차년도` : "6년 이후"} value={value * 100} onChange={(next) => updateForm("ramp", form.ramp.map((item, itemIndex) => itemIndex === index ? next / 100 : item))} suffix="%" step={5} />)}</div></div>
            <div className="next-bar"><p><strong>{result.crop.name}</strong> · 10a당 총수입 {integer.format(result.crop.revenue)}천원 · 경영비 {integer.format(result.crop.cost)}천원</p><button className="button primary" onClick={() => setActiveTab(4)}>평가결과 확인 →</button></div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="page-section results-page" aria-live="polite">
            <div className="section-heading split-heading"><div><span className="section-kicker">4·5단계 · 자동 계산 결과</span><h2>{form.applicant || "신청자"}님의 SAFE 평가결과</h2><p>{form.crop} · {integer.format(form.area)}㎡ · {form.supportType} · 단위: 백만원</p></div><div className="result-actions"><button className="button ghost" onClick={() => setActiveTab(3)}>입력 수정</button><button className="button primary" onClick={() => window.print()}>결과 인쇄·PDF</button></div></div>
            <div className="result-banner"><div><span>사전체크</span><strong className={precheck.ready ? "positive" : "caution"}>{precheck.ready ? "상담 가능" : "보완 필요"}</strong></div><div><span>정성평가</span><strong>{qualitative.total.toFixed(1)}점 · {qualitative.grade}등급</strong></div><div><span>모델 점검</span><strong className={result.allChecksPass ? "positive" : "caution"}>{result.allChecksPass ? "PASS" : "CHECK"}</strong></div><div><span>자동 투자판정</span><strong>제공하지 않음</strong></div></div>
            <div className="summary-strip four result-metrics"><Metric label="정상연도 기준소득" value={`${money.format(selectedSummary.income)}백만원`} note={`소득률 ${pct.format(selectedSummary.margin)}`} tone="good" /><Metric label="거치기간 연평균 잔여" value={`${money.format(selectedSummary.graceAverage)}백만원`} note="이자·기존 원리금 차감" /><Metric label="원금상환기간 연평균 잔여" value={`${money.format(selectedSummary.repayAverage)}백만원`} note="원금·이자·기존 원리금 차감" tone={selectedSummary.repayAverage < 0 ? "danger" : "good"} /><Metric label="최저 연간 잔여소득" value={`${money.format(selectedSummary.minimum)}백만원`} note="30년 중 최저값" tone={selectedSummary.minimum < 0 ? "danger" : "good"} /></div>
            <section className="result-section"><div className="result-title"><div><span>SCENARIO</span><h3>시나리오별 정상소득과 상환 후 금액</h3></div><p>음수여도 부적정으로 자동 판정하지 않습니다. 부족자금 대응계획을 함께 검토하세요.</p></div><div className="table-wrap"><table><thead><tr><th>시나리오</th><th>정상 총수입</th><th>정상 경영비</th><th>정상 예상소득</th><th>소득률</th><th>거치기간 잔여 평균</th><th>원금상환 잔여 평균</th><th>30년 누적 잔여</th><th>최저 연간 잔여</th></tr></thead><tbody>{result.summaries.map((row) => <tr key={row.key}><th><span className={`dot ${scenarioMeta[row.key].tone}`} />{scenarioMeta[row.key].label}</th><td>{money.format(row.revenue)}</td><td>{money.format(row.cost)}</td><td><strong>{money.format(row.income)}</strong></td><td>{pct.format(row.margin)}</td><td>{money.format(row.graceAverage)}</td><td className={row.repayAverage < 0 ? "negative" : ""}>{money.format(row.repayAverage)}</td><td>{money.format(row.cumulative)}</td><td className={row.minimum < 0 ? "negative" : ""}>{money.format(row.minimum)}</td></tr>)}</tbody></table></div></section>
            <section className="result-section chart-section"><div className="result-title"><div><span>30-YEAR OUTLOOK</span><h3>연도별 원리금 차감 후 잔여소득</h3></div><div className="legend"><span><i className="base" />기준</span><span><i className="down" />보수</span><span><i className="up" />낙관</span></div></div><div className="chart-shell"><svg viewBox="0 0 900 260" role="img" aria-label="30년 시나리오별 잔여소득 선 그래프"><line x1="24" x2="876" y1={zeroY} y2={zeroY} className="zero-line" />{[0, 1, 2, 3].map((line) => <line key={line} x1="24" x2="876" y1={40 + line * 60} y2={40 + line * 60} className="grid-line" />)}<polyline points={points("base")} className="chart-line base" /><polyline points={points("conservative")} className="chart-line down" /><polyline points={points("optimistic")} className="chart-line up" />{[1, 5, 10, 15, 20, 25, 30].map((year) => <text key={year} x={24 + (year - 1) * (852 / 29)} y="250" textAnchor="middle">{year}년</text>)}</svg><div className="chart-callout"><span>기준 시나리오 최저</span><strong>{money.format(selectedSummary.minimum)}백만원</strong></div></div></section>
            <section className="result-section two-column-result"><div><div className="result-title"><div><span>FINANCING</span><h3>자금별 정책조건</h3></div></div><div className="loan-cards">{result.loans.map((loan) => <article key={loan.name}><div><strong>{loan.name}</strong><span className={loan.supported ? "positive" : "muted"}>{loan.requested <= 0 ? "미신청" : loan.supported ? "지원 반영" : "지원대상 아님"}</span></div><p><b>{money.format(loan.requested)}</b>백만원 신청</p><dl><div><dt>분석 반영</dt><dd>{money.format(loan.analyzed)}백만원</dd></div><div><dt>적용금리</dt><dd>{pct.format(loan.rate)}</dd></div><div><dt>거치 / 상환</dt><dd>{loan.grace}년 / {loan.repay}년</dd></div><div><dt>연간 원금</dt><dd>{money.format(loan.repay ? loan.analyzed / loan.repay : 0)}백만원</dd></div></dl></article>)}</div></div><div><div className="result-title"><div><span>MODEL CHECK</span><h3>입력·산식 점검</h3></div></div><div className="checks-list">{result.checks.map((check) => <div key={check.label}><span className={check.ok ? "ok" : "check"}>{check.ok ? "✓" : "!"}</span><p><strong>{check.label}</strong><small>{check.note}</small></p><b>{check.ok ? "OK" : "확인"}</b></div>)}</div></div></section>
            <details className="schedule-details"><summary>30년 연도별 상세표 보기</summary><div className="table-wrap"><table><thead><tr><th>연도</th><th>전망구간</th><th>가동률</th><th>원금</th><th>이자</th><th>총 원리금</th><th>기준 잔여</th><th>보수 잔여</th><th>낙관 잔여</th><th>기말 대출잔액</th></tr></thead><tbody>{result.schedule.map((row) => <tr key={row.year}><th>{row.year}</th><td>{row.period}</td><td>{pct.format(row.utilization)}</td><td>{money.format(row.principal)}</td><td>{money.format(row.interest)}</td><td>{money.format(row.debt)}</td><td className={row.remaining.base < 0 ? "negative" : ""}>{money.format(row.remaining.base)}</td><td className={row.remaining.conservative < 0 ? "negative" : ""}>{money.format(row.remaining.conservative)}</td><td className={row.remaining.optimistic < 0 ? "negative" : ""}>{money.format(row.remaining.optimistic)}</td><td>{money.format(row.closing)}</td></tr>)}</tbody></table></div></details>
            <div className="final-disclaimer"><strong>결과 해석 전 확인하세요</strong><p>농산물소득조사는 표본농가의 평균자료이며 스마트팜 전용 원가자료가 아닙니다. 신규 시설의 감가상각, 세금, 생활비, 담보·신용, 개별 에너지 구조와 실제 금융비용은 별도 검토해야 합니다. 낙관 시나리오는 보장값이 아닙니다.</p></div>
          </div>
        )}
      </section>
      <footer><div><span className="brand-mark small">S</span><p><strong>SAFE 스마트농업 타당성평가</strong><small>SAFE_ver1.0(2026.8.13.) 기반 공개용 계산기</small></p></div><p>© 2026 SAFE · 참고용 평가모델</p></footer>
    </main>
  );
}
