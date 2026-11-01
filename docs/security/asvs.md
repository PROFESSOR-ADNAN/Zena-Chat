# OWASP ASVS Level 2 Verification Matrix

| Section | Control Description | Status | Verification & Code Evidence |
|---------|---------------------|--------|------------------------------|
| **V1.1** | Secure Architecture | DONE | Stateless gateway replicas, Redis adapter, ADRs 0001–0017 |
| **V2.1** | Password Security | DONE | Bcrypt 12 rounds in `User.js`, password excluded by default (`select: false`) |
| **V2.2** | Credential Storage | DONE | No plaintext passwords; rotated refresh tokens stored hashed with SHA-256 |
| **V3.1** | Session Management | DONE | 15-minute JWT access tokens; instant cross-node revocation via Redis `auth:control` |
| **V4.1** | Access Control | DONE | `assertParticipant` check enforced on every socket event and REST history endpoint |
| **V5.1** | Input Validation | DONE | Zod schemas validate every socket event (`@zena/shared`) and REST body |
| **V5.2** | Sanitization & XSS | DONE | Message text rendered as plain text in React; CSP headers forbid inline scripts |
| **V8.1** | Data Protection | DONE | TLS in transit; zero message content in logs; PII export and deletion |
| **V13.1** | API Security | DONE | RFC 9457 Problem Details; rate limits on login/register |
| **V14.1** | Build & Config | DONE | Docker non-root users (`USER node`); minimal Alpine base images |
