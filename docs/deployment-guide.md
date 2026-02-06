# AbiPago — Guía de Despliegue e Integración

> Guía paso a paso para desplegar los smart contracts, configurar ENS, e integrar todo en la app React Native.

---

## Tabla de Contenidos

1. [Prerequisitos](#1-prerequisitos)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Smart Contracts: Despliegue](#3-smart-contracts-despliegue)
4. [ENS: Configurar Payment Profile](#4-ens-configurar-payment-profile)
5. [Frontend: Integrar ENS Resolution](#5-frontend-integrar-ens-resolution)
6. [Frontend: Integrar LI.FI Composer](#6-frontend-integrar-lifi-composer)
7. [Frontend: Integrar WalletConnect](#7-frontend-integrar-walletconnect)
8. [Frontend: Integrar PayRouter (ABI)](#8-frontend-integrar-payrouter-abi)
9. [Frontend: NFC & QR](#9-frontend-nfc--qr)
10. [Testing E2E](#10-testing-e2e)
11. [Checklist Final para Submission](#11-checklist-final-para-submission)

---

## 1. Prerequisitos

### Herramientas necesarias

```bash
# Node.js (v18+)
node --version

# pnpm
pnpm --version

# Foundry (forge, cast, anvil)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Expo CLI
npx expo --version
```

### Cuentas y API Keys

| Servicio | Para qué | Obtener |
|----------|----------|---------|
| **Alchemy/Infura** | RPC para Base y Arbitrum | https://alchemy.com |
| **LI.FI** | API de rutas cross-chain | https://li.fi (sin API key para testing) |
| **WalletConnect** | Conexión de wallets | https://cloud.walletconnect.com (Project ID) |
| **ENS** | Nombre .eth con text records | https://app.ens.domains |
| **Etherscan/Basescan** | Verificar contratos | https://basescan.org/apis |

### Wallets necesarias

1. **Deployer wallet**: Con ETH en Base para gas de deploy (~0.001 ETH)
2. **Merchant wallet**: La que recibirá los pagos (configurada en ENS)
3. **Payer wallet**: Para testear pagos (con ETH en Arbitrum/alguna cadena)

---

## 2. Estructura del Proyecto

```
htm-abipago/
├── apps/
│   └── frontend/          ← React Native (Expo)
│       ├── app/           ← Pantallas (Expo Router)
│       ├── constants/     ← Tema, colores
│       ├── types/         ← TypeScript types
│       └── services/      ← [CREAR] ENS, LI.FI, PayRouter services
│
├── packages/
│   └── contracts/         ← Foundry (Solidity)
│       ├── src/           ← PayRouter.sol + interfaces
│       ├── script/        ← Deploy scripts
│       ├── test/          ← Forge tests
│       └── lib/           ← forge-std
│
└── docs/                  ← Documentación
```

---

## 3. Smart Contracts: Despliegue

### 3.1. Compilar (una vez Foundry funcione)

```bash
cd packages/contracts
forge build
```

### 3.2. Test local con Anvil

```bash
# Terminal 1: local testnet
anvil

# Terminal 2: deploy al fork local
forge script script/DeployPayRouter.s.sol:DeployPayRouter \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

> ⚠️ La private key de arriba es la default de Anvil (#0), NO usar en mainnet.

### 3.3. Deploy a Base Mainnet (para la demo)

```bash
# Crear .env en packages/contracts/
cat > packages/contracts/.env << 'EOF'
PRIVATE_KEY=tu_private_key_aqui
UNIVERSAL_ROUTER=0x6fF5693b99212Da76ad316178A184AB56D299b43
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/TU_API_KEY
BASESCAN_API_KEY=tu_basescan_api_key
EOF

# Cargar variables
source packages/contracts/.env

# Deploy + verificar
forge script script/DeployPayRouter.s.sol:DeployPayRouter \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

### 3.4. Direcciones de Universal Router (Uniswap V4)

| Chain | ChainId | Universal Router |
|-------|---------|-----------------|
| Base | 8453 | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| Arbitrum | 42161 | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| Optimism | 10 | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| Ethereum | 1 | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` |

> ⚠️ Verifica siempre en: https://docs.uniswap.org/contracts/v4/deployments

### 3.5. Guardar la dirección del contrato desplegado

Después del deploy, Foundry imprimirá algo como:

```
=== PayRouter deployed ===
  Address: 0x1234...abcd    ← GUARDAR ESTO
  Owner:   0x84e5...3a19
```

Guarda esa dirección — la necesitarás para:
- El ENS text record `pay.router`
- La configuración del frontend

---

## 4. ENS: Configurar Payment Profile

### 4.1. Obtener un nombre ENS

Si no tienes uno:
1. Ve a https://app.ens.domains
2. Busca un nombre (ej. `tucafe.eth`)
3. Registra (cuesta ~$5/año para 5+ chars)

Para testing puedes usar una subname gratis o un nombre en testnet.

### 4.2. Configurar Text Records

En la app de ENS (https://app.ens.domains/tucafe.eth):

1. Click en tu nombre → **Profile** → **Edit Records**
2. Agrega estos **Text Records**:

| Key | Value | Descripción |
|-----|-------|-------------|
| `pay.receiver` | `0x84e5cA5c3a194193CC62c5f7E483e68507003a19` | Wallet del merchant |
| `pay.chainId` | `8453` | Base mainnet |
| `pay.token` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC on Base |
| `pay.slippageBps` | `50` | 0.5% slippage |
| `pay.memo` | `Mi Cafetería` | Nombre legible |
| `pay.expirySec` | `600` | Invoices expiran en 10 min |
| `pay.router` | `0x1234...abcd` | Dirección del PayRouter desplegado |

3. Click **Save** → confirma la transacción

### 4.3. Verificar con cast (Foundry)

```bash
# Resolver dirección
cast resolve-name cafeteria.eth --rpc-url https://eth.llamarpc.com

# Leer text records (requiere llamar al resolver directamente)
# O verificar en: https://app.ens.domains/cafeteria.eth
```

### 4.4. Tokens conocidos por chain

| Chain | Token | Address | Decimals |
|-------|-------|---------|----------|
| Base | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| Base | WETH | `0x4200000000000000000000000000000000000006` | 18 |
| Arbitrum | USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| Arbitrum | WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | 18 |

---

## 5. Frontend: Integrar ENS Resolution

### 5.1. Instalar dependencias

```bash
cd apps/frontend
pnpm add ethers@^6.0.0 @ensdomains/ensjs@^4.0.0
```

### 5.2. Crear servicio ENS

Crear `apps/frontend/services/ens.ts`:

```typescript
import { ethers } from 'ethers';
import type { PaymentProfile } from '@/types';

// Usamos un RPC público de Ethereum mainnet para resolver ENS
const ETH_RPC = 'https://eth.llamarpc.com';

const provider = new ethers.JsonRpcProvider(ETH_RPC);

/**
 * Resuelve un ENS name y lee los text records de payment profile.
 */
export async function resolvePaymentProfile(
  ensName: string
): Promise<PaymentProfile> {
  // 1. Obtener el resolver del nombre
  const resolver = await provider.getResolver(ensName);
  if (!resolver) {
    throw new Error(`ENS name "${ensName}" not found or has no resolver`);
  }

  // 2. Resolver dirección principal
  const address = await resolver.getAddress();

  // 3. Leer text records en paralelo
  const [receiver, chainId, token, slippageBps, memo, expirySec, router, tipBps] =
    await Promise.all([
      resolver.getText('pay.receiver'),
      resolver.getText('pay.chainId'),
      resolver.getText('pay.token'),
      resolver.getText('pay.slippageBps'),
      resolver.getText('pay.memo'),
      resolver.getText('pay.expirySec'),
      resolver.getText('pay.router'),
      resolver.getText('pay.tipBps'),
    ]);

  // 4. Construir el PaymentProfile
  return {
    receiver: receiver || address || '',
    chainId: chainId ? parseInt(chainId) : 8453,
    token: token || '',
    slippageBps: slippageBps ? parseInt(slippageBps) : 50,
    memo: memo || '',
    expirySec: expirySec ? parseInt(expirySec) : 600,
    router: router || '',
    tipBps: tipBps ? parseInt(tipBps) : undefined,
  };
}

/**
 * Solo resuelve el ENS name a una dirección.
 */
export async function resolveENSAddress(ensName: string): Promise<string | null> {
  return provider.resolveName(ensName);
}
```

### 5.3. Uso en la app

```typescript
// En confirm-payment.tsx o donde se necesite:
import { resolvePaymentProfile } from '@/services/ens';

const profile = await resolvePaymentProfile('cafeteria.eth');
// profile.receiver  → "0x84e5..."
// profile.chainId   → 8453
// profile.token     → "0x8335..."
```

---

## 6. Frontend: Integrar LI.FI Composer

### 6.1. Instalar SDK

```bash
pnpm add @lifi/sdk@^4.0.0
```

### 6.2. Crear servicio LI.FI

Crear `apps/frontend/services/lifi.ts`:

```typescript
import { createConfig, getRoutes, getQuote } from '@lifi/sdk';
import type { PaymentProfile, RouteInfo } from '@/types';

// Inicializar LI.FI SDK
createConfig({
  integrator: 'abipago',
});

/**
 * Encuentra la mejor ruta cross-chain para pagar al merchant.
 */
export async function findPaymentRoute(params: {
  fromChainId: number;
  fromTokenAddress: string;
  fromAddress: string;
  toChainId: number;
  toTokenAddress: string;
  toAddress: string;        // PayRouter address
  fromAmount: string;       // en wei / smallest unit
  slippageBps?: number;
}): Promise<any> {
  const result = await getRoutes({
    fromChainId: params.fromChainId,
    toChainId: params.toChainId,
    fromTokenAddress: params.fromTokenAddress,
    toTokenAddress: params.toTokenAddress,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    options: {
      slippage: (params.slippageBps || 50) / 10000,
      allowSwitchChain: true,
      order: 'CHEAPEST',
    },
  });

  if (!result.routes || result.routes.length === 0) {
    throw new Error('No routes found');
  }

  return result.routes[0]; // Best route
}

/**
 * Convierte la ruta de LI.FI a nuestro RouteInfo para la UI.
 */
export function formatRouteForUI(lifiRoute: any): RouteInfo {
  const firstStep = lifiRoute.steps?.[0];
  const lastStep = lifiRoute.steps?.[lifiRoute.steps.length - 1];

  return {
    fromChainName: firstStep?.action?.fromChainId === 42161 ? 'Arbitrum' : `Chain ${firstStep?.action?.fromChainId}`,
    fromChainId: firstStep?.action?.fromChainId,
    toChainName: lastStep?.action?.toChainId === 8453 ? 'Base' : `Chain ${lastStep?.action?.toChainId}`,
    toChainId: lastStep?.action?.toChainId,
    fromToken: firstStep?.action?.fromToken?.address,
    fromTokenSymbol: firstStep?.action?.fromToken?.symbol,
    toToken: lastStep?.action?.toToken?.address,
    toTokenSymbol: lastStep?.action?.toToken?.symbol,
    fromAmount: lifiRoute.fromAmountUSD || firstStep?.action?.fromAmount,
    toAmount: lifiRoute.toAmountUSD || lastStep?.action?.toAmount,
    estimatedGasFee: `~$${(parseFloat(lifiRoute.gasCostUSD || '0')).toFixed(2)}`,
    estimatedTimeSeconds: lifiRoute.steps?.reduce((acc: number, s: any) =>
      acc + (s.estimate?.executionDuration || 0), 0) || 120,
    routeLabel: lifiRoute.steps?.map((s: any) => s.toolDetails?.name).join(' • ') || 'LI.FI',
  };
}
```

### 6.3. Flujo con LI.FI + PayRouter (contract call)

Para que LI.FI llame automáticamente a `PayRouter.settle()` después del bridge, usamos `contractCalls`:

```typescript
import { ethers } from 'ethers';

// ABI mínimo del PayRouter para encodear settle()
const PAY_ROUTER_ABI = [
  'function settle((address receiver, address tokenOut, uint256 amountOut, uint256 deadline, bytes32 ref, uint256 nonce) invoice, address tokenIn, uint256 amountIn, bytes swapData)',
];

/**
 * Construir la ruta completa con contract call al PayRouter.
 */
export async function buildPaymentTransaction(params: {
  payerAddress: string;
  payerChainId: number;
  payerToken: string;
  payerAmount: string;
  profile: PaymentProfile;
  invoice: { ref: string; amountOut: bigint };
}) {
  const iface = new ethers.Interface(PAY_ROUTER_ABI);

  // Construir el Invoice struct para el contrato
  const invoiceStruct = {
    receiver: params.profile.receiver,
    tokenOut: params.profile.token,
    amountOut: params.invoice.amountOut,
    deadline: BigInt(Math.floor(Date.now() / 1000) + (params.profile.expirySec || 600)),
    ref: ethers.keccak256(ethers.toUtf8Bytes(params.invoice.ref)),
    nonce: BigInt(Date.now()),
  };

  // swapData vacío si LI.FI ya entrega el token correcto
  const swapData = '0x';

  // Encodear la llamada a settle()
  const settleCalldata = iface.encodeFunctionData('settle', [
    invoiceStruct,
    params.profile.token,  // tokenIn == tokenOut si LI.FI ya swapeó
    params.invoice.amountOut,
    swapData,
  ]);

  // Buscar ruta de LI.FI con contract call
  const route = await findPaymentRoute({
    fromChainId: params.payerChainId,
    fromTokenAddress: params.payerToken,
    fromAddress: params.payerAddress,
    toChainId: params.profile.chainId,
    toTokenAddress: params.profile.token,
    toAddress: params.profile.router || '',
    fromAmount: params.payerAmount,
    slippageBps: params.profile.slippageBps,
  });

  return { route, settleCalldata, invoiceStruct };
}
```

---

## 7. Frontend: Integrar WalletConnect

### 7.1. Instalar dependencias

```bash
pnpm add @walletconnect/modal-react-native@^1.0.0 \
  @react-native-async-storage/async-storage \
  react-native-get-random-values \
  react-native-svg
```

### 7.2. Configurar Provider

En `apps/frontend/app/_layout.tsx`, envolver con el provider de WalletConnect:

```typescript
import { WalletConnectModal } from '@walletconnect/modal-react-native';

const projectId = 'TU_WALLETCONNECT_PROJECT_ID';

const providerMetadata = {
  name: 'AbiPago',
  description: 'Mobile payments with NFC/QR + ENS + LI.FI',
  url: 'https://abipago.xyz',
  icons: ['https://abipago.xyz/icon.png'],
};

// Agregar <WalletConnectModal projectId={projectId} providerMetadata={providerMetadata} />
// dentro del layout
```

### 7.3. Hook para wallet

Crear `apps/frontend/hooks/use-wallet.ts`:

```typescript
import { useWalletConnectModal } from '@walletconnect/modal-react-native';
import { ethers } from 'ethers';

export function useWallet() {
  const { open, isConnected, provider, address } = useWalletConnectModal();

  const connect = async () => {
    await open();
  };

  const getSigner = async () => {
    if (!provider) throw new Error('Wallet not connected');
    const ethersProvider = new ethers.BrowserProvider(provider);
    return ethersProvider.getSigner();
  };

  const sendTransaction = async (tx: ethers.TransactionRequest) => {
    const signer = await getSigner();
    return signer.sendTransaction(tx);
  };

  return {
    connect,
    isConnected,
    address,
    getSigner,
    sendTransaction,
  };
}
```

---

## 8. Frontend: Integrar PayRouter (ABI)

### 8.1. Exportar ABI después del build

Después de `forge build`, el ABI está en `packages/contracts/out/PayRouter.sol/PayRouter.json`.

```bash
# Copiar ABI al frontend
mkdir -p apps/frontend/constants/abis
cat packages/contracts/out/PayRouter.sol/PayRouter.json | \
  jq '.abi' > apps/frontend/constants/abis/PayRouter.json
```

### 8.2. O hardcodear el ABI mínimo

Crear `apps/frontend/constants/abis/PayRouter.ts`:

```typescript
export const PAYROUTER_ABI = [
  // settle()
  {
    inputs: [
      {
        components: [
          { name: 'receiver', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountOut', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'ref', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
        ],
        name: 'invoice',
        type: 'tuple',
      },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'swapData', type: 'bytes' },
    ],
    name: 'settle',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // PaymentExecuted event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'ref', type: 'bytes32' },
      { indexed: true, name: 'receiver', type: 'address' },
      { indexed: true, name: 'payer', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    name: 'PaymentExecuted',
    type: 'event',
  },
] as const;

// Direcciones del PayRouter desplegado (actualizar después del deploy)
export const PAYROUTER_ADDRESSES: Record<number, string> = {
  8453: '0x0000000000000000000000000000000000000000', // Base — REEMPLAZAR
  42161: '0x0000000000000000000000000000000000000000', // Arbitrum — si se despliega
};
```

---

## 9. Frontend: NFC & QR

### 9.1. Deep Link URI Scheme

El formato del URI para QR y NFC es:

```
abipago://pay?ens=cafeteria.eth&amount=3.50&ref=coffee42&assetHint=USDC
```

### 9.2. QR Code

```bash
pnpm add expo-camera react-native-qrcode-svg
```

**Generar QR** (merchant-invoice screen):
```typescript
import QRCode from 'react-native-qrcode-svg';

const uri = `abipago://pay?ens=cafeteria.eth&amount=${amount}&ref=${ref}&assetHint=USDC`;
<QRCode value={uri} size={200} backgroundColor="transparent" color="#FFFFFF" />
```

**Leer QR** (pay screen):
```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';

<CameraView
  onBarcodeScanned={({ data }) => {
    // data = "abipago://pay?ens=cafeteria.eth&..."
    const url = new URL(data);
    const invoice = {
      ens: url.searchParams.get('ens'),
      amount: url.searchParams.get('amount'),
      ref: url.searchParams.get('ref'),
      assetHint: url.searchParams.get('assetHint'),
    };
    router.push({ pathname: '/confirm-payment', params: invoice });
  }}
  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
/>
```

### 9.3. NFC (requiere native build)

```bash
pnpm add react-native-nfc-manager
# Requiere expo prebuild (no funciona en Expo Go)
npx expo prebuild
```

**Escribir NFC tag** (merchant):
```typescript
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

async function writeNfcTag(uri: string) {
  await NfcManager.start();
  await NfcManager.requestTechnology(NfcTech.Ndef);

  const bytes = Ndef.encodeMessage([Ndef.uriRecord(uri)]);
  await NfcManager.ndefHandler.writeNdefMessage(bytes);
  await NfcManager.cancelTechnologyRequest();
}
```

**Leer NFC tag** (payer):
```typescript
async function readNfcTag(): Promise<string> {
  await NfcManager.start();
  await NfcManager.requestTechnology(NfcTech.Ndef);

  const tag = await NfcManager.getTag();
  await NfcManager.cancelTechnologyRequest();

  if (tag?.ndefMessage) {
    const record = tag.ndefMessage[0];
    return Ndef.uri.decodePayload(record.payload);
  }
  throw new Error('No NDEF data found');
}
```

---

## 10. Testing E2E

### 10.1. Flujo de prueba completo

```
1. Merchant configura ENS text records ✅
2. Merchant crea invoice en la app → genera QR
3. Payer escanea QR → app parsea URI
4. App resuelve ENS → obtiene payment profile
5. App consulta LI.FI → obtiene ruta
6. App muestra confirm screen → usuario aprueba
7. WalletConnect firma tx → LI.FI ejecuta bridge
8. LI.FI llama PayRouter.settle() en Base
9. PayRouter transfiere USDC al merchant
10. App muestra success screen con tx hash
```

### 10.2. Para la demo del hackathon

**Opción A: Demo real (mainnet)**
- Usar cantidades pequeñas ($1-5)
- Base como chain destino (gas barato)
- Arbitrum como chain origen
- USDC como token destino

**Opción B: Demo con fork local**
```bash
# Fork de Base mainnet
anvil --fork-url $BASE_RPC_URL --chain-id 8453

# Deploy PayRouter al fork
forge script script/DeployPayRouter.s.sol:DeployPayRouter \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Impersonate una wallet con USDC para testing
cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "transfer(address,uint256)" \
  0xTuWallet 1000000000 \
  --rpc-url http://127.0.0.1:8545 \
  --from 0xWalletConUSDC \
  --unlocked
```

---

## 11. Checklist Final para Submission

### Smart Contracts
- [ ] PayRouter desplegado en Base mainnet
- [ ] Contrato verificado en Basescan
- [ ] Al menos 1 tx de settle() exitosa
- [ ] Guardar tx hashes para el README

### ENS
- [ ] ENS name registrado con text records configurados
- [ ] `pay.receiver`, `pay.chainId`, `pay.token` mínimo
- [ ] Verificar que la app resuelve correctamente

### LI.FI
- [ ] Ruta cross-chain funcional
- [ ] Al menos 1 bridge+swap exitoso
- [ ] Screenshot/tx hash del bridge

### Frontend
- [ ] App corre con `npx expo start`
- [ ] QR scan funcional
- [ ] NFC funcional (o simulado con botón)
- [ ] Todas las pantallas navegables

### Submission
- [ ] Video demo 2-4 minutos
- [ ] README con instrucciones de setup
- [ ] Repo público en GitHub
- [ ] Historial de commits limpio
- [ ] Seleccionar 3 prizes: Uniswap, LI.FI, ENS
- [ ] Incluir tx IDs en el README

---

## Orden Recomendado de Implementación

```
Fase 1: Contratos (1-2 horas)
├── Fix forge build
├── Deploy PayRouter en Base
└── Verificar en Basescan

Fase 2: ENS (30 min)
├── Registrar/configurar nombre
└── Verificar text records

Fase 3: Frontend Services (3-4 horas)
├── services/ens.ts (resolver ENS)
├── services/lifi.ts (rutas cross-chain)
├── Conectar WalletConnect
├── Conectar confirm-payment con ENS real
├── Conectar routing-progress con LI.FI real
└── Conectar payment-success con tx hashes reales

Fase 4: QR/NFC (1-2 horas)
├── Generar QR reales
├── Escanear QR con cámara
└── NFC (si hay tiempo)

Fase 5: Polish + Demo (2 horas)
├── Testing E2E con cantidades reales
├── Grabar video demo
├── Escribir README final
└── Submit
```
