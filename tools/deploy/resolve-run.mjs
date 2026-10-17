// Executado apenas pelo workflow confiável de publicação, nunca pelo PR.
import { appendFileSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY;
const runId = process.env.CI_RUN_ID;
if (!/^\d+$/.test(runId ?? '')) throw new Error('Execução de CI inválida.');
async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${path}`);
  return response.json();
}
const run = await api(`actions/runs/${runId}`);
const ci = await api('actions/workflows/ci.yml');
if (run.workflow_id !== ci.id || run.path !== '.github/workflows/ci.yml' || run.status !== 'completed' || run.conclusion !== 'success') {
  throw new Error('Somente artefatos de CI concluído e aprovado podem ser publicados.');
}
const main = (await api('git/ref/heads/main')).object.sha;
let prNumber = '';
let base = '';
let mode;
if (run.event === 'pull_request') {
  prNumber = String(run.pull_requests[0]?.number ?? '');
  if (!/^[1-9]\d*$/.test(prNumber)) throw new Error('CI sem PR associado.');
  const pr = await api(`pulls/${prNumber}`);
  if (pr.state !== 'open' || pr.base.ref !== 'main' || pr.head.repo.full_name !== repo ||
      pr.head.sha !== run.head_sha || pr.base.sha !== main || run.pull_requests[0].base.sha !== main) {
    throw new Error('PR externo, fechado ou desatualizado: gerar novo CI e nova prévia.');
  }
  mode = 'preview';
  base = main;
} else if (['push', 'workflow_dispatch'].includes(run.event) && run.head_branch === 'main' && run.head_sha === main) {
  mode = 'production';
} else {
  throw new Error('A execução não é de um PR interno nem do main atual.');
}
for (const [key, value] of Object.entries({ mode, pr: prNumber, head: run.head_sha, base, run: String(run.id), attempt: String(run.run_attempt) })) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
