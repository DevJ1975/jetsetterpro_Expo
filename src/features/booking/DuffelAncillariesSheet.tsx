import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { palette } from '@/src/ui';
import { DUFFEL_ANCILLARIES_JS } from './duffelBundle.generated';

// Seat + bag selection via Duffel's <duffel-ancillaries> web component.
// @duffel/components is a react-dom library — it cannot mount in React
// Native — so it runs inside this WebView on a vendored, version-pinned
// bundle; its onPayloadReady event posts the CreateOrderPayload back to RN.
//
// Pricing markup (owner-configured): +1.00 +1% per bag, +2.00 flat per seat.
const MARKUP = {
  bags: { amount: 1, rate: 0.01 },
  seats: { amount: 2, rate: 0 },
};

export interface AncillariesResult {
  payload: Record<string, unknown>; // CreateOrderPayload
  metadata: Record<string, unknown>; // chosen services summary
}

export default function DuffelAncillariesSheet({
  offer,
  seatMaps,
  passengers,
  onReady,
  onError,
}: {
  offer: Record<string, unknown>;
  seatMaps: unknown[] | null;
  passengers: Record<string, unknown>[];
  onReady: (result: AncillariesResult) => void;
  onError?: (message: string) => void;
}) {
  const html = useMemo(() => {
    const input = JSON.stringify({
      offer,
      seat_maps: seatMaps ?? undefined,
      passengers,
      services: ['bags', 'seats'],
      markup: MARKUP,
      debug: false,
    });
    // The bundle is CJS — shim module/exports, evaluate, then render the
    // self-registered custom element and bridge its events to RN.
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>
  html,body{margin:0;padding:0;background:#F6F7FB;}
  #root{padding:12px 12px 32px;}
  duffel-ancillaries{display:block;}
</style>
</head><body>
<div id="root"><duffel-ancillaries id="anc"></duffel-ancillaries></div>
<script>var module={exports:{}};var exports=module.exports;</script>
<script>${DUFFEL_ANCILLARIES_JS}</script>
<script>
(function(){
  var post = function(msg){ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  try {
    var el = document.getElementById('anc');
    var input = ${JSON.stringify(input).replace(/</g, '\\u003c')};
    var data = JSON.parse(input);
    el.addEventListener('onPayloadReady', function(e){
      post({ type: 'payloadReady', payload: e.detail && e.detail.data, metadata: e.detail && e.detail.metadata });
    });
    el.render(data);
    post({ type: 'rendered' });
  } catch (err) {
    post({ type: 'error', message: String(err && err.message || err) });
  }
  window.onerror = function(m){ post({ type: 'error', message: String(m) }); };
})();
</script>
</body></html>`;
  }, [offer, seatMaps, passengers]);

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data) as {
              type: string;
              payload?: Record<string, unknown>;
              metadata?: Record<string, unknown>;
              message?: string;
            };
            if (msg.type === 'payloadReady' && msg.payload) {
              onReady({ payload: msg.payload, metadata: msg.metadata ?? {} });
            } else if (msg.type === 'error') {
              onError?.(msg.message ?? 'ancillaries_failed');
            }
          } catch {
            // ignore malformed frames
          }
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} size="large" />
          </View>
        )}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F6F7FB' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
