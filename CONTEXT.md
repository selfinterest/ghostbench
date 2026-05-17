# Ghostbench

Ghostbench is the domain of evaluating vibe-coded application repositories for product coherence, runtime health, maintainability, and readiness for further agent work.

## Language

**Ghostbench**:
A local-first eval harness for judging vibe-coded application repositories.
_Avoid_: Chatbot, coding assistant, generic code quality scanner

**Vibe-Coded Repository**:
A repository substantially created or evolved through AI-assisted coding, evaluated by its current contents rather than by proving how each line was produced.
_Avoid_: AI repo, generated app

**Vibe-Coded Application Repository**:
A vibe-coded repository whose primary artifact is an application a user can run or interact with.
_Avoid_: Generated app, prototype dump

**Reduced Assessment**:
A readiness assessment that omits or weakens dimensions that do not apply to the evaluated repository.
_Avoid_: Failed assessment, partial run

**App Owner**:
A person deciding whether a vibe-coded application repository is ready to ship, hand off, or continue developing with agents.
_Avoid_: Developer, buyer, evaluator

**Eval Case**:
A reusable assessment scenario that supplies an app brief, optional repository source, expected areas, and scoring emphasis for a vibe-coded repository.
_Avoid_: Test case, benchmark prompt, task file

**Task**:
The repository-grounded change, investigation, or plan described by an eval case.
_Avoid_: Prompt, assignment

**App Brief**:
The product intent and user expectations a vibe-coded application repository is evaluated against.
_Avoid_: Prompt, task, requirements doc

**Brief Source**:
The origin of an app brief, such as an eval case, CLI input, repository documentation, or inference fallback.
_Avoid_: Prompt source, requirements source

**Inferred Brief**:
An app brief reconstructed from repository contents when no explicit brief is supplied.
_Avoid_: Auto brief, generated requirements

**Framework Signals**:
Repository evidence that identifies the app stack and the checks or expectations that usually apply to it.
_Avoid_: Framework detection, stack scan

**Primary App Stack**:
The application stack Ghostbench evaluates with first-class framework signals and execution checks.
_Avoid_: Supported stack, target framework

**Repo Context**:
A bounded snapshot of one target repository available to the judge.
_Avoid_: Index, corpus, full repository clone

**Repo Source**:
The user-supplied local path or GitHub repository reference that Ghostbench resolves before building repo context.
_Avoid_: Input repo, target string

**Remote Repo Source**:
A GitHub repository URL, with optional ref, that Ghostbench resolves to a local cache checkout before scanning.
_Avoid_: API repo, online scan

**Execution Check**:
An attempted local command that observes whether a vibe-coded application repository installs, builds, typechecks, tests, or runs.
_Avoid_: Test, CI, runtime scan

**Interactive Check**:
An optional execution check that observes a locally running application through a browser or similar user-interface surface.
_Avoid_: Visual test, browser test, screenshot review

**Execution Policy**:
The user-selected trust level that controls which local commands Ghostbench may run while evaluating a repository.
_Avoid_: Mode, permissions, sandbox

**Inspect Policy**:
An execution policy that performs static evaluation without running repository commands.
_Avoid_: Dry run, static mode

**Check Policy**:
An execution policy that runs low-risk declared checks only when dependencies are already present.
_Avoid_: Safe mode, test mode

**Sandboxed Policy**:
A reserved execution policy for future constrained temporary workspace behavior; in the current MVP it records a skipped execution check.
_Avoid_: Container mode, isolated mode

**Trusted Policy**:
A reserved execution policy for future explicit in-repository install/run behavior; in the current MVP it records a skipped execution check.
_Avoid_: Full mode, unsafe mode

**Static Evaluation**:
Evaluation based only on repository contents and metadata.
_Avoid_: Code review, lint

**Execution Evaluation**:
Evaluation that combines repository contents with local execution checks.
_Avoid_: Integration test, end-to-end test

**Agent Response**:
A candidate answer from a coding agent for an eval case.
_Avoid_: Model output, completion, plan

**Fixture Response**:
A saved local response available for offline evaluation.
_Avoid_: Mock, golden file

**Fixture Repository**:
A local sample repository used for deterministic offline readiness assessment.
_Avoid_: Mock app, golden repo

**Rubric**:
A weighted set of criteria for judging a vibe-coded repository within a readiness assessment.
_Avoid_: Checklist, grading guide

**Rubric Item**:
One weighted criterion inside a rubric.
_Avoid_: Criterion, scoring row

**Expected Files**:
Advisory files or repository areas that an eval author believes are relevant to an eval case.
_Avoid_: Target files, answer key

**Expected Areas**:
Advisory repository areas, app surfaces, or workflows that an app owner believes are relevant to a readiness assessment.
_Avoid_: Expected files, answer key, hidden labels

**Run**:
A single execution of an assessment command or eval case against one vibe-coded repository.
_Avoid_: Session, execution

**Assessment Command**:
The CLI entry point that evaluates a vibe-coded repository and produces a readiness assessment.
_Avoid_: Run command, scan command

**Judgment**:
A structured scoring result for a vibe-coded repository against a rubric or readiness dimension.
_Avoid_: Grade, review

**Provider-Assisted Assessment**:
An explicit opt-in assessment layer that uses an external model to interpret collected evidence.
_Avoid_: Default judge, model score

**Readiness Assessment**:
The app-facing result that explains whether a vibe-coded application repository is ready to ship, hand off, or continue developing.
_Avoid_: Grade, audit, leaderboard result

**Remediation Guidance**:
Prioritized, repo-grounded advice about what an app owner should fix next to improve readiness.
_Avoid_: Patch, code generation, autofix

**Product Coherence**:
The degree to which a vibe-coded application repository expresses a recognizable and internally consistent product.
_Avoid_: Product quality, feature completeness

**Runtime Health**:
The degree to which a vibe-coded application repository can be installed, checked, built, tested, or run locally.
_Avoid_: CI status, uptime

**UX Completeness**:
The degree to which core user flows, states, navigation, and responsive behavior are represented in the application.
_Avoid_: Design quality, polish

**Maintainability**:
The degree to which a vibe-coded application repository is structured so a human or agent can safely extend it.
_Avoid_: Code quality, cleanliness

**Safety**:
The degree to which a vibe-coded application repository avoids obvious security, privacy, secret-handling, and dependency risks.
_Avoid_: Security audit, compliance

**Agent Readiness**:
The degree to which a vibe-coded application repository gives a future coding agent enough structure and context to continue work without guessing.
_Avoid_: Agent compatibility, documentation quality

**Score**:
The numeric evaluation inside a judgment.
_Avoid_: Judgment, grade

**Verdict**:
The qualitative outcome of a judgment.
_Avoid_: Label, rating

**Ready Verdict**:
A readiness verdict indicating no blocking concerns were found and remaining guidance is incremental.
_Avoid_: Ship, pass

**Conditionally Ready Verdict**:
A readiness verdict indicating the repository is usable or handoffable only if named concerns are accepted or fixed.
_Avoid_: Maybe, warning

**Not Ready Verdict**:
A readiness verdict indicating blocking runtime, safety, product, or maintainability concerns.
_Avoid_: Fail, broken

**Unknown Verdict**:
A readiness verdict indicating insufficient brief, repo context, or execution permission to make a confident assessment.
_Avoid_: Inconclusive, skipped

**Ranking**:
The ordering of agent responses within a run by judgment outcome.
_Avoid_: Winner, leaderboard, comparison

**Evidence**:
A repo-grounded reason that supports a judgment.
_Avoid_: Reason, proof

**Concern**:
A reason to distrust or downgrade a readiness assessment or evaluated artifact.
_Avoid_: Issue, problem

**Blocking Concern**:
A concern severe enough to prevent a ready or conditionally ready assessment.
_Avoid_: Critical issue, failure

**Warning**:
A caveat about a run or repo context that may limit judgment confidence without preventing evaluation.
_Avoid_: Concern, error

**Report**:
A durable markdown or JSON artifact containing judgments or readiness assessment results for an eval case.
_Avoid_: Console output, log

**Console Summary**:
A terminal-oriented summary of judgments for an eval case.
_Avoid_: Report, log

**Repo Understanding**:
The degree to which an assessment or agent response is grounded in the repository's actual structure and constraints.
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

- An **Eval Case** may describe one **Task** when preserving an older agent-response scenario.
- An **Eval Case** has one **App Brief** when evaluating a **Vibe-Coded Application Repository**.
- An **App Brief** has one **Brief Source**.
- An **Inferred Brief** is an **App Brief** with lower assessment confidence.
- **Framework Signals** help interpret a **Vibe-Coded Application Repository** without replacing the **App Brief**.
- The **Primary App Stack** receives first-class **Framework Signals** and **Execution Checks**.
- An **Eval Case** has one **Rubric**.
- A **Rubric** contains one or more **Rubric Items**.
- An **Eval Case** may identify **Expected Areas**.
- **Expected Files** are legacy path-shaped **Expected Areas**.
- An **Eval Case** may identify one **Repo Source**.
- A **Remote Repo Source** is a **Repo Source**.
- A **Repo Source** resolves to one **Repo Context**.
- An **Eval Case** is evaluated against one **Repo Context**.
- A **Repo Context** may have zero or more **Warnings**.
- An **Execution Evaluation** includes one **Repo Context**.
- An **Execution Evaluation** includes zero or more **Execution Checks**.
- An **Interactive Check** is an optional **Execution Check**.
- An **Execution Evaluation** has one **Execution Policy**.
- An **Execution Policy** is one of **Inspect Policy**, **Check Policy**, **Sandboxed Policy**, or **Trusted Policy**.
- A **Static Evaluation** includes one **Repo Context** and no command-running **Execution Checks**; it may record a skipped policy check.
- A **Warning** may explain why an **Execution Check** could not run.
- A **Warning** may explain that an **Inferred Brief** was used.
- A **Warning** may explain why a **Reduced Assessment** was produced.
- A **Run** may execute one **Eval Case**.
- A **Run** includes exactly one **Repo Context**.
- A **Run** evaluates one **Vibe-Coded Application Repository** by default.
- A **Run** may produce a **Reduced Assessment** when the evaluated **Vibe-Coded Repository** is not a **Vibe-Coded Application Repository**.
- A **Run** may evaluate one or more **Agent Responses** when preserving an older agent-response scenario.
- A **Run** produces one **Readiness Assessment** for each evaluated **Vibe-Coded Application Repository**, or one or more **Judgments** when preserving an older agent-response scenario.
- A **Run** has one **Ranking** only when comparing multiple evaluated artifacts.
- A **Run** produces one **Readiness Assessment** for each evaluated **Vibe-Coded Application Repository**.
- A **Run** surfaces zero or more **Warnings**.
- A **Run** produces one **Report**.
- A **Run** produces one **Console Summary**.
- An **Assessment Command** starts a **Run** for one evaluated **Vibe-Coded Repository**.
- A **Report** helps an **App Owner** decide what to trust or fix next.
- A selected **Fixture Response** supplies an **Agent Response** for a legacy-style **Run**.
- A **Fixture Repository** supplies a deterministic **Vibe-Coded Repository** for offline assessment.
- A **Judgment** scores one evaluated artifact for one **Run**.
- A **Provider-Assisted Assessment** interprets collected **Evidence**, **Concerns**, and **Execution Checks**.
- A **Provider-Assisted Assessment** does not replace the default deterministic **Readiness Assessment**.
- A **Judgment** has one **Score**.
- A **Judgment** has exactly one **Verdict**.
- A **Readiness Assessment** has one **Ready Verdict**, **Conditionally Ready Verdict**, **Not Ready Verdict**, or **Unknown Verdict**.
- A **Readiness Assessment** includes dimension-level scores, evidence, concerns, blocking concerns, and a readiness verdict.
- A **Readiness Assessment** evaluates **Product Coherence**, **Runtime Health**, **UX Completeness**, **Maintainability**, **Safety**, and **Agent Readiness**.
- A **Readiness Assessment** may include **Remediation Guidance**.
- **Remediation Guidance** is grounded in **Evidence**, **Concerns**, or **Execution Checks**.
- A **Judgment** contains zero or more **Evidence** entries.
- A **Judgment** contains zero or more **Concerns**.
- A **Blocking Concern** is a **Concern** that blocks readiness because it prevents installation, launch, core user flow validation, safe handoff, agent continuation, or required configuration.
- A **Report** contains one **Readiness Assessment** or one or more legacy **Judgments**.
- A **Report** contains one **Ranking** when its **Run** compares multiple legacy evaluated artifacts.
- A **Console Summary** summarizes one **Readiness Assessment** or one or more legacy **Judgments**.
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

> **Dev:** "This **Vibe-Coded Application Repository** has a dashboard brief, but the **Execution Check** could not run and the scanned UI has no empty or error states."
> **Domain expert:** "Then the **Readiness Assessment** should surface a **Blocking Concern** only if that prevents a ready handoff; otherwise make it **Remediation Guidance** under **Runtime Health** or **UX Completeness**."

## Flagged Ambiguities

- "case" should mean **Eval Case** in Ghostbench unless a more specific testing context is being discussed.
- "response" should mean **Agent Response** only when discussing the legacy agent-response workflow.
- "understanding" should be expressed as **Repo Understanding** only when discussing repository grounding; the pivot's app-facing outcome is **Readiness Assessment**.
- Patch generation is outside the current **Remediation Guidance** boundary, but may become a separate future capability.
