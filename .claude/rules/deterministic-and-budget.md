# Deterministic & Budget Rules

### 5. Deterministic First

**Claude is for judgment calls. Plain code does everything else.**

Fetching, filtering, routing, persisting, dispatching — none of it is a language task. Don't ask the model to "decide if we should retry" when a status code already answers. Use the model for: classification, drafting, summarization, extraction from unstructured text. That's the whole list.

The failure mode without this rule: the model makes a routing decision one week, a different routing decision the next, and you've reinvented flaky if-else at $0.003/token.

### 6. Declare Budgets, Halt On Breach

**No silent overruns. Ever.**

Every AI step runs under a token budget: per-step, per-pipeline, per-day. Exceeding any of the three halts the pipeline immediately, logs the breach, and surfaces it to the operator. Budgets live in config, not in prompts.

```yaml
budgets:
  per_step_tokens: 2048
  per_pipeline_tokens: 10000
  per_day_tokens: 100000
```

The failure mode without this rule: a runaway loop burns $40 overnight and you find out from the invoice.

### 7. Human-In-The-Loop Is A First-Class Step Type

**Label destructive actions. Require approval. No exceptions via flags.**

Anything touching the outside world — sending an email, updating a CRM, posting a message — is an `approval` step, not an `ai` step. The approval is routed to an operator channel (Slack, Telegram, whatever) with approve/edit/reject controls. The pipeline blocks until a decision is recorded.

```yaml
- name: approve-send
  type: approval
  mode: hitl
  channel: telegram
```

The failure mode without this rule: a hallucinated follow-up email goes to a real customer.

### 8. Validate AI Output Against A Schema

**Unstructured strings don't belong in deterministic downstream code.**

Every AI step declares an output schema. The runtime rejects anything that doesn't match — missing fields, wrong types, out-of-range numbers. Rejected outputs trigger a retry (under budget) or halt.

```yaml
output_schema:
  type: object
  required: [match, reason, score]
  properties:
    match:  { type: boolean }
    reason: { type: string, maxLength: 280 }
    score:  { type: integer, minimum: 0, maximum: 100 }
```

The failure mode without this rule: a boolean comes back as the string `"maybe"` and a downstream `if` branches the wrong way.

For generated React and Next.js code, I use [agentproof-react](https://github.com/renezander030/agentproof-react) as a small deterministic review gate before shipping.

### 9. Sanitize Operator Input Before It Reaches A Prompt

**User-supplied text is not trusted.**

Before any operator or external input enters a prompt, strip role markers (`system:`, `assistant:`, `�` variants), enforce length limits, and normalize markdown so formatting can't break prompt boundaries. This is prompt-injection defense, not input validation — the goal is to stop an attacker from pivoting the model mid-run.

### 10. Log Rejections Silently

**Don't narrate to the attacker.**

When input is rejected for sanitization or schema violations, log internally — never echo the rejection reason back to the source. A detailed error message is a free signal that tells the attacker which pattern to try next.

## The "working if" test

The full ten rules are working if:

- Diffs are smaller and more targeted (rules 1–4).
- Pipeline runs have predictable token costs (rule 6).
- No AI output ever reaches a production side-effect without a human approval record (rule 7).
- Downstream code never branches on a malformed AI response (rule 8).
- Operator-channel logs show silent rejections rather than echoed errors (rules 9–10).

If even one of those is failing, the rule isn't enforced — it's aspirational.
