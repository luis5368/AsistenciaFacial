# Frontend

Laboratorio de Fase 1 con React, Vite, TypeScript, Tailwind, ONNX Runtime Web,
Dexie para métricas técnicas y Workbox para recursos offline.

Desde la raíz: `npm.cmd ci`, `npm.cmd run assets`, `npm.cmd run build`,
`npm.cmd run preview`. Abrir `http://127.0.0.1:4173`.
Consultar [protocolo y límites](../../docs/fase-1.md).

`src/engine.ts` procesa YuNet/SFace; `math.ts` implementa geometría/comparación;
`storage.ts` conserva solo recursos públicos y mediciones sin biometría;
`main.tsx` controla consentimiento, cámara y perfiles temporales en memoria.
No se persisten fotografías ni embeddings ni existe comunicación con backend.
