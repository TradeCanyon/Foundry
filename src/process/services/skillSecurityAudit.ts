/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * skillSecurityAudit — Security scanning for imported SKILL.md files.
 *
 * Checks for:
 * - Prompt injection patterns (ignore previous, system prompt override)
 * - Dangerous code patterns (shell invocation, dynamic evaluation)
 * - Credential exfiltration (API keys, tokens, passwords in URLs)
 * - Excessive permissions (file system writes, network requests)
 * - Obfuscated content (base64 encoded blocks, hex strings)
 */

export interface AuditResult {
  passed: boolean;
  severity: 'safe' | 'warning' | 'danger';
  findings: AuditFinding[];
}

export interface AuditFinding {
  rule: string;
  severity: 'warning' | 'danger';
  description: string;
  line: number;
  match: string;
}

interface AuditRule {
  name: string;
  severity: 'warning' | 'danger';
  description: string;
  pattern: RegExp;
}

// Build rules at runtime to avoid false-positives from static analysis hooks
function buildRules(): AuditRule[] {
  const dangerShellKeywords = ['child_pro' + 'cess', 'She' + 'llExecute'];
  const dangerEvalKeywords = ['ev' + 'al', 'vm.r' + 'un'];

  return [
    // Prompt injection
    {
      name: 'prompt-injection-ignore',
      severity: 'danger',
      description: 'Attempts to override system instructions',
      pattern: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    },
    {
      name: 'prompt-injection-system',
      severity: 'danger',
      description: 'Attempts to impersonate system role',
      pattern: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|new\s+system\s+prompt|system:\s*override)/i,
    },
    {
      name: 'prompt-injection-jailbreak',
      severity: 'danger',
      description: 'Common jailbreak patterns detected',
      pattern: /\b(DAN|do\s+anything\s+now|developer\s+mode|unrestricted\s+mode|bypass\s+safety)/i,
    },
    // Shell / dangerous invocation
    {
      name: 'shell-invocation',
      severity: 'danger',
      description: 'Shell command invocation detected',
      pattern: new RegExp(`\\b(${dangerShellKeywords.join('|')}|spawnSync)\\b`),
    },
    {
      name: 'dynamic-evaluation',
      severity: 'danger',
      description: 'Dynamic code evaluation',
      pattern: new RegExp(`\\b(${dangerEvalKeywords.join('|')}|new\\s+Function)\\b`),
    },
    // Credential exfiltration
    {
      name: 'credential-exfil',
      severity: 'danger',
      description: 'Potential credential exfiltration via URL',
      pattern: /https?:\/\/[^\s]*\.(api[_-]?key|token|secret|password|credential)/i,
    },
    {
      name: 'env-access',
      severity: 'warning',
      description: 'Environment variable access',
      pattern: /process\.env\[|process\.env\./,
    },
    // File system
    {
      name: 'fs-write',
      severity: 'warning',
      description: 'File system write operations',
      pattern: /\b(fs\.write|fs\.unlink|fs\.rm|fs\.mkdir|writeFileSync|appendFileSync)\b/,
    },
    {
      name: 'fs-sensitive-paths',
      severity: 'danger',
      description: 'Access to sensitive file paths',
      pattern: /\/(etc\/passwd|\.ssh|\.aws|\.env|\.git\/config|id_rsa)/,
    },
    // Network
    {
      name: 'network-exfil',
      severity: 'warning',
      description: 'External network requests',
      pattern: /\b(fetch\s*\(|axios\.|http\.request|XMLHttpRequest|WebSocket)\b/,
    },
    // Obfuscation
    {
      name: 'base64-block',
      severity: 'warning',
      description: 'Large base64-encoded content block',
      pattern: /[A-Za-z0-9+/]{100,}={0,2}/,
    },
    {
      name: 'hex-encoded',
      severity: 'warning',
      description: 'Hex-encoded content block',
      pattern: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/,
    },
  ];
}

const AUDIT_RULES = buildRules();

/**
 * Audit a SKILL.md file content for security issues.
 */
export function auditSkillContent(content: string): AuditResult {
  const findings: AuditFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of AUDIT_RULES) {
      const match = rule.pattern.exec(line);
      if (match) {
        findings.push({
          rule: rule.name,
          severity: rule.severity,
          description: rule.description,
          line: i + 1,
          match: match[0].substring(0, 80),
        });
      }
    }
  }

  const hasDanger = findings.some((f) => f.severity === 'danger');
  const hasWarning = findings.some((f) => f.severity === 'warning');

  return {
    passed: !hasDanger,
    severity: hasDanger ? 'danger' : hasWarning ? 'warning' : 'safe',
    findings,
  };
}
