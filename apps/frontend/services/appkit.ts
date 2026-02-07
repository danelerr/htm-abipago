/**
 * Reown WalletConnect AppKit — configuration & singleton
 *
 * IMPORTANT: `@walletconnect/react-native-compat` MUST be imported before
 * any other WalletConnect / AppKit import.  We enforce this here so the
 * rest of the app can simply import from this module.
 */
import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─── Chain Definitions (viem canonical) ─────────────────────────── */
import { base, arbitrum, mainnet, optimism, polygon } from 'viem/chains';

/* ─── Storage adapter (wraps AsyncStorage → AppKit Storage) ──────── */
const appKitStorage = {
  async getKeys() {
    return AsyncStorage.getAllKeys() as Promise<string[]>;
  },
  async getEntries<T = any>() {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys as string[]);
    return pairs.map(([k, v]) => [k, v ? JSON.parse(v) : undefined] as [string, T]);
  },
  async getItem<T = any>(key: string) {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  },
  async setItem<T = any>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

/* ─── Adapters ───────────────────────────────────────────────────── */
const ethersAdapter = new EthersAdapter();

/* ─── Metadata ───────────────────────────────────────────────────── */
const metadata = {
  name: 'AbiPago',
  description: 'Pay any merchant with any token on any chain',
  url: 'https://abipago.xyz',
  icons: ['https://abipago.xyz/icon.png'],
  redirect: {
    native: 'abipago://',
  },
};

/* ─── Project ID (Reown Cloud) ───────────────────────────────────── */
const PROJECT_ID = 'd5eedc7048c5cf81e76dc446bfbb0928';

/* ─── Networks ───────────────────────────────────────────────────── */
const networks = [base, arbitrum, mainnet, optimism, polygon];

/* ─── Create singleton AppKit instance ───────────────────────────── */
export const appKit = createAppKit({
  projectId: PROJECT_ID,
  metadata,
  networks,
  defaultNetwork: base,
  adapters: [ethersAdapter],
  storage: appKitStorage,
  features: {
    socials: false,
    swaps: false,
    onramp: false,
  },
});

/* Re-export hooks for convenience */
export {
  useAppKit,
  useAccount,
  useAppKitState,
  useProvider,
  useWalletInfo,
} from '@reown/appkit-react-native';

export { AppKit, AppKitProvider } from '@reown/appkit-react-native';
