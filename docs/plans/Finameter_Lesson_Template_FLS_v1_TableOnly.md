# Finameter Lesson Template (FLS v1) — Table-Only Diagrams

## 0) Lesson Header Card (UI)

| Field | Spec |
|---|---|
| Lesson title | `{Event} → {Asset/Theme}` |
| Difficulty | Beginner / Intermediate / Advanced |
| Time | Core: 3–5 min · Deepening: 8–12 min |
| Tags | e.g., `Geopolitics` `Risk-on/off` `Rates` `Inflation` `Crypto` |
| Learning outcomes | 2–3 measurable outcomes (e.g., “Explain risk-on/off in 20s”) |
| Disclaimer | Education only · Not investment advice |

---

## 1) What Happened (2–3 bullets max)

| Element | Rule | Output format |
|---|---|---|
| Event facts | Only verifiable statements from the article | 1–2 lines |
| Market question | Convert facts → “So what for markets?” | 1 line |
| Timing/liquidity | Note if weekend, reopen gap, thin liquidity | 1 line |

---

## 2) Concept Cards (3–5 max)

| Concept | Plain meaning (1 line) | Why it moves prices (1 line) | In this article (1 line) | Common confusion (1 line) |
|---|---|---|---|---|
| Concept 1 |  |  |  |  |
| Concept 2 |  |  |  |  |
| Concept 3 |  |  |  |  |
| (Optional 4–5) |  |  |  |  |

---

## 3) Mechanism Map (Signature) — Table Diagram

### 3A) 3-Lane Transmission Table (Shock → Channels → Prices)

| Lane | Step 1 (Shock) | Step 2 (Channel) | Step 3 (Market variable) | Step 4 (Asset impact) | Confidence (L/M/H) |
|---|---|---|---|---|---|
| Lane A (Risk sentiment) |  |  |  |  |  |
| Lane B (Energy/Inflation) |  |  |  |  |  |
| Lane C (Rates/USD) |  |  |  |  |  |
| Lane D (Liquidity/Positioning) |  |  |  |  |  |

### 3B) Edge List (for interactive node graph later)

| From (Node) | → | To (Node) | Relationship type | Evidence from article | Strength (1–5) |
|---|---:|---|---|---|---:|
|  | → |  | causal / correlational / assumption |  |  |
|  | → |  |  |  |  |

> **Rule:** Every “edge” must be tagged as **Evidence** (explicit in article) or **Inference** (your explanation).

---

## 4) Asset Impact Matrix (Direction + Why)

| Asset | Typical reaction in this regime | Direction (↑/↓/↔/mixed) | Mechanism driver (choose 1–2) | Confidence (L/M/H) |
|---|---|---:|---|---|
| BTC |  |  | Risk premium / Liquidity / Rates / USD / Narrative |  |
| Equities (Nasdaq proxy) |  |  |  |  |
| USD |  |  |  |  |
| Gold |  |  |  |  |
| Oil |  |  |  |  |
| UST (price/yield) |  |  |  |  |

---

## 5) “One Chart, One Skill” — Table Practice (No chart needed)

| Skill target | Inputs from article | Level/Zone (if any) | Scenario A (If…) | Scenario B (If…) | What to watch (non-advice) |
|---|---|---:|---|---|---|
| Identify support/resistance + conditional reasoning |  |  |  |  |  |

### Rules

| Guardrail | Meaning |
|---|---|
| No prediction language | Use “If… then risk increases” not “will happen” |
| Tie to mechanism | Every scenario must cite 1 mechanism channel |
| Keep it short | 2 scenarios only |

---

## 6) Quiz + Poll (Learning Loop)

### 6A) Quiz Blueprint (max 6 questions)

| Q# | Type | Prompt | Options (A–D) | Correct | Explanation (1–2 lines) |
|---:|---|---|---|---|---|
| 1 | Recall |  |  |  |  |
| 2 | Recall |  |  |  |  |
| 3 | Mechanism |  |  |  |  |
| 4 | Mechanism |  |  |  |  |
| 5 | Application |  |  |  |  |
| 6 | Application |  |  |  |  |



---

## 7) Output Schema (for your generator / consistent UI)

| Key | Type | Notes |
|---|---|---|
| lesson_header | object | title, difficulty, time, tags, outcomes |
| what_happened | array | 2–3 items |
| concept_cards | array | 3–5 rows |
| mechanism_lanes | array | lane table rows |
| mechanism_edges | array | edge list rows |
| asset_impact_matrix | array | asset rows |
| one_skill_practice | object | scenario table |
| quiz | object | questions array |
| poll | object | question + choices |
| mastery | object | flashcards + teachback |
