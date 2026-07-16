import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, palette, spacing, type } from '@/src/ui';
import { Sentry } from '@/src/core/observability/sentry';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/** App-wide safety net: any render/lifecycle exception below the root lands
 *  here instead of a blank white screen. Logs to the console (visible in dev
 *  and captured by any crash reporter wired later) and lets the user retry. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Report to Sentry when configured (no-op otherwise) with the React
    // component stack attached for triage.
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: palette.ink, justifyContent: 'center', padding: spacing.xl }}>
        <Text style={[type.heading, { color: palette.bright, marginBottom: spacing.sm }]}>
          Something went wrong
        </Text>
        <Text style={[type.bodyDim, { marginBottom: spacing.lg }]}>
          IRIS hit an unexpected error. Your trips and data are safe on this device — tap below to try again.
        </Text>
        {__DEV__ ? (
          <ScrollView
            style={{ maxHeight: 180, marginBottom: spacing.lg }}
            contentContainerStyle={{ paddingRight: spacing.md }}
          >
            <Text style={[type.caption, { color: palette.dim }]}>{error.message}</Text>
          </ScrollView>
        ) : null}
        <Button title="Try again" onPress={this.reset} />
      </View>
    );
  }
}
