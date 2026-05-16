# Ghostbench

Ghostbench is the domain of evaluating whether coding agents understood a repository before proposing changes.

## Language

**Ghostbench**:
A local-first eval harness for judging repository-aware coding agents.
_Avoid_: Chatbot, coding assistant

**Eval Case**:
A repository-change scenario used to evaluate an agent response.
_Avoid_: Test case, benchmark prompt, task file

**Task**:
The repository-grounded change, investigation, or plan described by an eval case.
_Avoid_: Prompt, assignment

**Repo Context**:
A bounded snapshot of one target repository available to the judge.
_Avoid_: Index, corpus, full repository clone

**Agent Response**:
A candidate answer from a coding agent for an eval case.
_Avoid_: Model output, completion, plan

**Fixture Response**:
A saved local response available for offline evaluation.
_Avoid_: Mock, golden file

**Rubric**:
A weighted set of criteria for judging an agent response.
_Avoid_: Checklist, grading guide

**Rubric Item**:
One weighted criterion inside a rubric.
_Avoid_: Criterion, scoring row

**Expected Files**:
Advisory files or repository areas that an eval author believes are relevant to an eval case.
_Avoid_: Target files, answer key

**Run**:
A single execution of an eval case against one or more agent responses.
_Avoid_: Session, execution

**Judgment**:
The structured result of scoring an agent response against an eval case and rubric.
_Avoid_: Grade, review

**Score**:
The numeric evaluation inside a judgment.
_Avoid_: Judgment, grade

**Verdict**:
The qualitative outcome of a judgment.
_Avoid_: Label, rating

**Ranking**:
The ordering of agent responses within a run by judgment outcome.
_Avoid_: Winner, leaderboard, comparison

**Evidence**:
A repo-grounded reason that supports a judgment.
_Avoid_: Reason, proof

**Concern**:
A reason to distrust or downgrade an agent response.
_Avoid_: Issue, problem

**Warning**:
A caveat about a run or repo context that may limit judgment confidence without preventing evaluation.
_Avoid_: Concern, error

**Report**:
A durable markdown artifact containing judgments for an eval case.
_Avoid_: Console output, log

**Console Summary**:
A terminal-oriented summary of judgments for an eval case.
_Avoid_: Report, log

**Repo Understanding**:
The degree to which an agent response is grounded in the repository's actual structure and constraints.
_Avoid_: Repo awareness, codebase comprehension

**Invented File**:
A file named by an agent response that is not present in the available repo context.
_Avoid_: Hallucinated file, fake path

**Invented Symbol**:
A function, class, command, or named code element mentioned by an agent response that is not present in the available repo context.
_Avoid_: Hallucinated symbol, fake API

**Unsupported Claim**:
A confident statement in an agent response that is not backed by the repo context.
_Avoid_: Hallucination, speculation

**Overbroad Rewrite**:
A proposed replacement of more repository behavior than the task requires.
_Avoid_: Rewrite from scratch, overhaul

**Generic Plan**:
A proposed strategy that could apply to many repositories without using task-specific or repo-specific evidence.
_Avoid_: Template answer, boilerplate plan

**Bounded Plan**:
A proposed implementation or investigation strategy limited to the task-relevant parts of the repository.
_Avoid_: Implementation plan, rewrite plan

## Relationships

- An **Eval Case** has one **Task**.
- An **Eval Case** has one **Rubric**.
- A **Rubric** contains one or more **Rubric Items**.
- An **Eval Case** may identify **Expected Files**.
- An **Eval Case** is evaluated against one **Repo Context**.
- A **Repo Context** may have zero or more **Warnings**.
- A **Run** executes exactly one **Eval Case**.
- A **Run** includes exactly one **Repo Context**.
- A **Run** evaluates one or more **Agent Responses**.
- A **Run** produces one or more **Judgments**.
- A **Run** has one **Ranking** when it evaluates multiple **Agent Responses**.
- A **Run** surfaces zero or more **Warnings**.
- A **Run** produces one **Report**.
- A **Run** produces one **Console Summary**.
- A selected **Fixture Response** supplies an **Agent Response** for a **Run**.
- A **Judgment** scores exactly one **Agent Response** for exactly one **Eval Case**.
- A **Judgment** has one **Score**.
- A **Judgment** has exactly one **Verdict**.
- A **Judgment** contains zero or more **Evidence** entries.
- A **Judgment** contains zero or more **Concerns**.
- A **Report** contains one or more **Judgments**.
- A **Report** contains one **Ranking** when its **Run** evaluates multiple **Agent Responses**.
- A **Console Summary** summarizes one or more **Judgments**.
- A **Report** surfaces zero or more **Warnings**.
- A **Console Summary** surfaces zero or more **Warnings**.
- **Evidence** supports **Repo Understanding**.
- A **Concern** weakens **Repo Understanding**.
- An **Invented File** can produce a **Concern**.
- An **Invented Symbol** can produce a **Concern**.
- An **Unsupported Claim** can produce a **Concern**.
- An **Overbroad Rewrite** can produce a **Concern**.
- A **Generic Plan** can produce a **Concern**.
- A **Bounded Plan** is evidence for **Repo Understanding**.
- A **Bounded Plan** can produce **Evidence**.
- An **Overbroad Rewrite** weakens a **Bounded Plan**.

## Example Dialogue

> **Dev:** "This **Agent Response** mentions `src/layout/Grid.ts`, but that path is not in the **Repo Context**."
> **Domain expert:** "Then record it as an **Invented File** and let the **Judgment** penalize its **Repo Understanding**."

## Flagged Ambiguities

- "case" should mean **Eval Case** in Ghostbench unless a more specific testing context is being discussed.
- "response" should mean **Agent Response** unless explicitly referring to a CLI or API response.
- "understanding" should be expressed as **Repo Understanding** when discussing what Ghostbench evaluates.
