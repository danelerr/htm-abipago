import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { C } from '@/constants/theme';

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
    </ThemeProvider>
  );
}
