import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import 'react-native-reanimated';
import { C } from '@/constants/theme';
import { appKit, AppKit, AppKitProvider } from '@/services/appkit';

/* Suppress non-fatal WalletConnect relay errors (stale sessions auto-recover) */
LogBox.ignoreLogs([
  'No matching key',
  "session topic doesn't exist",
  'WebSocket connection closed abnormally',
  'Fatal socket error',
]);

/* Silence unhandled-promise rejections from WC relay reconnect loops */
if (typeof globalThis !== 'undefined') {
  const _EU = (globalThis as any).ErrorUtils;
  if (_EU) {
    const _orig = _EU.getGlobalHandler();
    _EU.setGlobalHandler((error: any, isFatal: boolean) => {
      const msg = String(error?.message ?? '');
      if (
        !isFatal &&
        (msg.includes('No matching key') ||
          msg.includes("session topic doesn't exist") ||
          msg.includes('WebSocket connection closed abnormally'))
      ) {
        return; // swallow non-fatal WC relay errors
      }
      _orig?.(error, isFatal);
    });
  }
}

const AbiPagoDark = {
  ...DarkTheme,
  dark: true as const,
  colors: {
    ...DarkTheme.colors,
    primary: C.primary,
    background: C.bgDark,
    card: C.bgDark,
    text: C.white,
    border: C.borderDark,
  },
};

export default function RootLayout() {
  return (
    <AppKitProvider instance={appKit}>
      <ThemeProvider value={AbiPagoDark}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bgDark },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="merchant-invoice"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="confirm-payment" />
          <Stack.Screen name="routing-progress" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="payment-success"
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
        </Stack>
        <StatusBar style="light" />

        {/* AppKit manages its own Modal – just mount it once */}
        <AppKit />
      </ThemeProvider>
    </AppKitProvider>
  );
}
