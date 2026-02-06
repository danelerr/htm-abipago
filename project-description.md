# AbiPago — Mobile intent payments (NFC/QR) + ENS Payment Profiles + LI.FI Composer + Uniswap v4

## Resumen (1-liner)
**AbiPago** es una app móvil de pagos que permite **cobrar y pagar** con **Tap (NFC tag) o Scan (QR)**.  
El cobro referencia un **ENS name** del comercio (ej. `cafeteria.eth`). AbiPago lee desde ENS las **preferencias de cobro** (token/red/destino) y ejecuta la mejor ruta para pagar usando **LI.FI Composer** (swap/bridge/call cross-chain) y, cuando hace falta, realiza el **swap final en Uniswap v4** para entregar exactamente lo que el comercio pidió.

---

## Por qué existe (problema)
En pagos cripto reales hay 3 fricciones:
1) El comercio y el usuario rara vez están en la **misma red** o con el **mismo token**.
2) Configurar “dónde cobro” requiere infraestructura centralizada o settings manuales (fragilidad / vendor lock-in).
3) UX: el usuario solo quiere “pagar”, no entender bridges/routing/slippage.

---

## Solución (idea central)
AbiPago convierte un cobro (invoice) en:
- **Identidad + preferencias portables** en ENS (Payment Profile).
- **Ejecución cross-chain** con LI.FI Composer (swap+bridge+(call)).
- **Liquidación final** usando Uniswap v4 (si el token recibido no coincide con el token pedido).

---

## Alcance del MVP (HackMoney)
### Modo Merchant (Cobrar)
- El merchant usa un ENS name (ej. `cafeteria.eth`).
- Configura su “Payment Profile” (en ENS Text Records) con:
  - `pay.receiver` = address destino
  - `pay.chainId` = chainId de liquidación (EVM)
  - `pay.token` = address del token que desea recibir (ej. USDC)
  - Opcional: `pay.memo`, `pay.tipBps`, `pay.slippageBps`, `pay.expirySec`
- Crea un cobro: monto + referencia (ej. `3.50`, `coffee#42`).
- AbiPago genera:
  - **QR** con un deep link del invoice
  - y/o escribe un **NFC Tag (NDEF)** con el mismo payload.

### Modo Payer (Pagar)
- Conecta wallet (WalletConnect).
- Toca NFC / escanea QR.
- La app:
  1) Lee invoice (ens + monto + ref).
  2) Resuelve `ens -> profile` desde ENS.
  3) Calcula ruta: “desde mis fondos (token/chain) -> token destino en chain destino”.
  4) Ejecuta ruta:
     - LI.FI: swap/bridge/(contract call) cross-chain
     - PayRouter (en destino): recibe fondos, (opcional) hace swap Uniswap v4, paga al merchant
  5) Muestra recibo con txids.

---

## “Creative ENS” (el diferencial)
### ENS Text Records como Payment Profile
En vez de usar ENS solo para “nombre -> address”, AbiPago usa ENS para publicar **settings de pago** portables del comercio.

**Records propuestos:**
- `pay.receiver` = `0x...` (receiver final)
- `pay.chainId` = `8453` (ejemplo Base mainnet) / o la chain principal elegida
- `pay.token` = `0x...` (USDC u otro)
- `pay.slippageBps` = `50` (0.50% por defecto)
- `pay.tipBps` = `0` o `500` (5% opcional)
- `pay.memo` = `"Cafetería SCZ"`
- `pay.expirySec` = `600` (invoice expira en 10 min)
- (opcional) `pay.router` = `0x...` (tu PayRouter en esa chain)

**Extra creativo (si da tiempo): invoice subnames**
- En lugar de un “ref” random, el merchant genera `inv-00042.cafeteria.eth` (subname)
- En los text records del subname pone `amount`, `expiry`, `note`
- El QR/NFC solo contiene el subname y AbiPago resuelve el resto.

---

## “LI.FI Composer” (lo que debes demostrar)
AbiPago usa LI.FI para orquestar en un solo flow:
- Swap / Bridge / (Swap+Bridge+Contract Call)

**Requisitos del premio (resumen):**
- 1 acción cross-chain usando SDK/API
- al menos 2 EVM chains en el journey
- frontend funcional (mobile OK)
- repo + video demo

⚠️ Nota importante: LI.FI indica que **ya no soporta testnets** y recomienda testear en **mainnets** con montos pequeños.

---

## “Uniswap v4 Privacy DeFi” (narrativa realista)
AbiPago se alinea a “privacy-enhancing” de forma pragmática:
- Reduce exposición operativa: el cobro no expone addresses en la UI (solo ENS).
- Payment settings están en ENS (no backend central / menos leakage).
- En la liquidación, el PayRouter puede ejecutar swaps v4 en un solo punto, reduciendo intent “fragmentado” en múltiples dApps.
- (Opcional) Batch settlement: PayRouter soporta `settleBatch()` para ejecutar varias liquidaciones en una tx y “blur” del patrón 1:1.

Hooks: **opcionales**. El MVP no depende de hooks.

---

## Arquitectura técnica (alto nivel)
### Componentes
1) **Mobile App (React Native)**
   - WalletConnect
   - Scan QR + NFC read/write (NDEF)
   - ENS resolver + lectura de text records
   - Integración LI.FI (quote/route/execute)
   - UI de receipts con txids

2) **PayRouter (Solidity) — contrato en chain destino**
   - Función `settle(invoice, proof)`:
     - valida invoice (deadline, amount)
     - recibe token de LI.FI (o del usuario)
     - si `tokenIn != tokenOut`: swap en Uniswap v4 (Universal Router)
     - transfiere `tokenOut` a `pay.receiver`
     - emite `PaymentExecuted(...)`
   - (Opcional) `settleBatch(invoices[])`

3) **Uniswap v4**
   - Se usa para swap final en la chain destino (si aplica)

4) **LI.FI**
   - Fuente de rutas cross-chain para mover fondos a la chain destino y (opcional) llamar al PayRouter.

5) **ENS**
   - Fuente de identidad (`name -> address`) y Payment Profile (text records).

---

## Esquema de invoice (payload QR/NFC)
**Formato simple (MVP):**
`abipago://pay?ens=cafeteria.eth&amount=3.50&ref=coffee42&assetHint=USDC`

- `ens`: ENS name del merchant
- `amount`: monto numérico (en “display units”)
- `ref`: referencia humana
- `assetHint`: opcional (si quieres mostrar “USDC” en UI aunque el profile diga otro)

La app siempre valida el invoice contra el ENS Payment Profile real (token/chain/receiver).

---

## Demo completo (guion 2–3 min)
1) Mostrar que `cafeteria.eth` tiene **Payment Profile** (en la app o en pantalla).
2) Modo Merchant:
   - “Crear cobro: 3.50”
   - Generar QR y/o escribir NFC tag
3) Modo Payer:
   - Conectar wallet (WalletConnect)
   - Tap NFC o Scan QR
   - Pantalla: “Pagar 3.50 a cafeteria.eth (recibe USDC en chainId X)”
4) Ejecutar pago:
   - Mostrar que la ruta es cross-chain (LI.FI)
   - Mostrar txid(s)
5) Confirmación:
   - Merchant recibe y ve receipt (evento PaymentExecuted)
   - (Opcional) segundo pago para mostrar robustez y/o batch

---

## Roadmap (en 4 días)
### Día 1 — Base app + QR/NFC + ENS read
- Scaffold RN + navegación (Merchant / Pay)
- QR generator + QR scanner
- NFC read/write (NDEF)
- ENS: resolve name + leer text records (`pay.*`)
- Mocks para invoice y profile

### Día 2 — WalletConnect + LI.FI quote/route
- Conectar wallet
- Integrar LI.FI SDK/API (quotes / routes / execute)
- Seleccionar 2 chains para el journey (mainnet recomendado por LI.FI)
- Manejo de errores: slippage, gas, insufficient funds

### Día 3 — PayRouter + Uniswap v4 swap final
- Deploy PayRouter en chain destino
- Integrar swap Uniswap v4 (Universal Router) en PayRouter
- Emitir evento PaymentExecuted
- End-to-end con un caso simple (pago directo sin swap) y uno con swap

### Día 4 — Pulido + demo video + submission
- UI: receipts, estado “routing / settled”
- README + setup + addresses + cómo correr
- Video 2–4 min + txids
- Seleccionar hasta 3 partner prizes: Uniswap + LI.FI + ENS

---

## Requisitos de ETHGlobal que debes cumplir sí o sí
- Proyecto hecho durante el hackathon (start fresh)
- Repo público + evidencia (commits)
- Video demo 2–4 min
- Puedes seleccionar **hasta 3 partner prizes** en el submission (elige bien)
- Transparencia si usaste herramientas de IA (documentarlo en README/submission)

---

## Lecturas / enlaces oficiales (prioridad)
### HackMoney / bounties
- HackMoney 2026 prizes: https://ethglobal.com/events/hackmoney2026/prizes
- HackMoney submission/judging info: https://ethglobal.com/events/hackmoney/info/details

### ENS
- ENS docs: https://docs.ens.domains
- ENS Text Records: https://docs.ens.domains/web/records

### LI.FI
- LI.FI docs: https://docs.li.fi/
- LI.FI Composer (E2E flows): https://docs.li.fi/introduction/user-flows-and-examples/lifi-composer
- API chains endpoint (ver support real): https://li.quest/v1/chains
- Testing integration note (testnets): https://docs.li.fi/sdk/testing-integration

### Uniswap v4
- Uniswap v4 deployments: https://docs.uniswap.org/contracts/v4/deployments
- v4 swap quickstart: https://docs.uniswap.org/contracts/v4/quickstart/swap
- v4 swap routing guide: https://docs.uniswap.org/contracts/v4/guides/swap-routing
- Universal Router overview: https://docs.uniswap.org/contracts/universal-router/overview

### NFC (RN)
- react-native-nfc-manager: https://github.com/revtel/react-native-nfc-manager
- Android NFC basics: https://developer.android.com/develop/connectivity/nfc/nfc

---

## Futuro post-hackathon (expansiones)
- Invoice subnames en ENS + expiración/verificación
- Batch settlement real con múltiples invoices (privacy/execution)
- Account abstraction / gas sponsorship (para UX “0 gas”)
- Merchant dashboard web + export contable
- “Pay from anywhere”: consolidación de balances multi-chain y recomendaciones de rutas
- Integración con rails locales (off-ramp) como etapa siguiente (fuera del scope hackathon)
