# ADR 0017: TypeScript Strategy Across Frontend, Shared Packages, and Backend

## Context
Maintainability and type safety are critical across a complex real-time system. Socket events, payloads, and domain models must stay synchronized between client and server.

## Decision
1. **Frontend (`web/`)**: 100% strict TypeScript with Vite and React.
2. **Shared Package (`packages/shared/`)**: TypeScript source generating both `.d.ts` types and runtime ESM JavaScript with Zod schemas.
3. **Backend Server (`server/`)**: Modern Node 22 ESM with runtime Zod validation for every HTTP route and Socket.IO event. This provides instant startup and dev iteration without build-step overhead, while guaranteeing strict schema validation at the boundaries.
4. **Worker (`worker/`)**: Modern Node 22 ESM consuming shared schemas and BullMQ.

## Alternatives Considered
- **Compiling backend via ts-node/tsx in production**: Adds process startup latency and potential memory overhead under load.
- **Pure JavaScript with no Zod schemas**: High risk of runtime bugs from malformed socket events or unvalidated inputs.

## Consequences
- **Positive**: Complete compile-time type safety for the React PWA; runtime validation on all gateway inputs; fast container builds for the backend.
- **Negative**: Requires maintaining Zod schemas as the single source of truth in `@zena/shared`.
