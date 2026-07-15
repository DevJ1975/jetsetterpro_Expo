import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId, toISODate } from '@/src/core/format';
import { julianToISODate, parseBcbp } from '@/src/features/itinerary/bcbp';
import { parseConfirmationText } from '@/src/features/itinerary/confirmationParser';
import { ITINERARY_META, type ItineraryItem, type ItineraryItemType } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

// Add/edit form for an itinerary item — port of the iOS AddItineraryItemView:
// the type selector reveals structured booking fields (flight ticket, hotel
// reservation, rental car), and a boarding-pass scan or pasted confirmation
// email prefills what it can. Pass `itemId` alongside `tripId` to edit in
// place (the form seeds from the item and Save replaces it via updateTrip).

const TYPES: ItineraryItemType[] = ['flight', 'hotel', 'car', 'restaurant', 'activity', 'other'];

const CABINS = ['economy', 'premium', 'business', 'first'] as const;
type Cabin = (typeof CABINS)[number];
const CABIN_LABEL: Record<Cabin, string> = {
  economy: 'Economy',
  premium: 'Premium',
  business: 'Business',
  first: 'First',
};

// Contextual date labels so the shared date row reads naturally per type (iOS parity).
const DATE_LABEL: Partial<Record<ItineraryItemType, string>> = {
  flight: 'Departure date',
  hotel: 'Check-in date',
  car: 'Pickup date',
};

export default function AddItemScreen() {
  const router = useRouter();
  const { tripId, itemId } = useLocalSearchParams<{ tripId: string; itemId?: string }>();
  const trip = useTravel((s) => s.trips.find((t) => t.id === tripId));
  const addItem = useTravel((s) => s.addItineraryItem);
  const updateTrip = useTravel((s) => s.updateTrip);
  const homeCurrency = usePreferences((s) => s.homeCurrency);

  const existing = itemId ? trip?.items.find((i) => i.id === itemId) : undefined;
  const seededRoute = routeOf(existing);

  // ── Form state (seeded from the item when editing) ─────────────────────────
  const [itemType, setItemType] = useState<ItineraryItemType>(existing?.type ?? 'flight');
  const [title, setTitle] = useState(existing?.title ?? '');
  // New items default to the trip's start rather than "now", so items on a
  // future trip don't get today's date and sort above the rest (iOS parity).
  const [date, setDate] = useState(
    existing ? datePartOf(existing.startDate) : (trip?.startDate ?? toISODate()),
  );
  const [time, setTime] = useState(existing ? timePartOf(existing.startDate) : '09:00');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [confirmation, setConfirmation] = useState(existing?.confirmation ?? '');
  const [cost, setCost] = useState(existing?.cost != null ? String(existing.cost) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? homeCurrency ?? 'USD');

  // Flight
  const [flightNo, setFlightNo] = useState(flightNoOf(existing));
  const [origin, setOrigin] = useState(seededRoute.origin);
  const [dest, setDest] = useState(seededRoute.dest);
  const [seat, setSeat] = useState(existing?.seat ?? '');
  const [cabin, setCabin] = useState<Cabin | ''>(cabinKeyOf(existing?.cabinClass));
  const [terminal, setTerminal] = useState(existing?.terminal ?? '');
  const [gate, setGate] = useState(existing?.gate ?? '');

  // Hotel
  const [address, setAddress] = useState(existing?.address ?? '');
  const [roomType, setRoomType] = useState(existing?.roomType ?? '');

  // Rental car
  const [pickup, setPickup] = useState(existing?.pickupLocation ?? '');
  const [dropoff, setDropoff] = useState(existing?.dropoffLocation ?? '');

  // Scan / paste import
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const isFlight = itemType === 'flight';
  const valid =
    !!tripId && (isFlight ? flightNo.trim().length > 0 || title.trim().length > 0 : title.trim().length > 0);

  // "AA100 JFK → LAX" — the flight title is composed, never typed (iOS parity).
  const flightTitle = composeFlightTitle(flightNo, origin, dest);

  // ── Prefill: boarding-pass scan ────────────────────────────────────────────

  /** Returns false when the payload doesn't parse, so the scanner shows an error. */
  const handleScanned = (raw: string): boolean => {
    const pass = parseBcbp(raw);
    if (!pass) return false;
    setItemType('flight');
    if (pass.carrier || pass.flightNumber) {
      setFlightNo(`${pass.carrier ?? ''}${pass.flightNumber ?? ''}`);
    }
    if (pass.origin) setOrigin(pass.origin);
    if (pass.dest) setDest(pass.dest);
    if (pass.seat) setSeat(pass.seat);
    // Confirmation only fills a blank, so a scan never clobbers what was typed.
    if (pass.pnr) setConfirmation((cur) => (cur.trim() ? cur : (pass.pnr ?? cur)));
    if (pass.julianDate != null) {
      const iso = julianToISODate(pass.julianDate);
      if (iso) setDate(iso);
    }
    setScanned(true);
    setScannerOpen(false);
    return true;
  };

  // ── Prefill: pasted confirmation text ──────────────────────────────────────

  const handlePasted = (text: string) => {
    const parsed = parseConfirmationText(text);
    const found: string[] = [];
    if (parsed.confirmation) {
      setConfirmation((cur) => (cur.trim() ? cur : (parsed.confirmation ?? cur)));
      found.push('confirmation');
    }
    if (isFlight) {
      if (parsed.flightNumber) {
        const composed = `${parsed.carrier ?? ''}${parsed.flightNumber}`;
        setFlightNo((cur) => (cur.trim() ? cur : composed));
        found.push('flight');
      }
      if (parsed.origin && parsed.dest) {
        setOrigin((cur) => (cur.trim() ? cur : (parsed.origin ?? cur)));
        setDest((cur) => (cur.trim() ? cur : (parsed.dest ?? cur)));
        found.push('route');
      }
      if (parsed.seat) {
        setSeat((cur) => (cur.trim() ? cur : (parsed.seat ?? cur)));
        found.push('seat');
      }
    }
    if (parsed.date) {
      setDate(parsed.date);
      found.push('date');
    }
    if (parsed.time) {
      setTime(parsed.time);
      found.push('time');
    }
    if (parsed.amount != null) {
      setCost((cur) => (cur.trim() ? cur : String(parsed.amount)));
      if (parsed.currency) setCurrency(parsed.currency);
      found.push('cost');
    }
    setPasteOpen(false);
    setImportSummary(
      found.length > 0
        ? `Found: ${found.join(', ')}`
        : 'No booking details recognized — fill in manually.',
    );
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = () => {
    if (!valid || !tripId) return;
    const start = new Date(`${date.trim()}T${time.trim() || '09:00'}:00`);
    const costNum = Number.parseFloat(cost.replace(/,/g, ''));
    const hasCost = Number.isFinite(costNum) && costNum > 0;

    const item: ItineraryItem = {
      id: existing?.id ?? makeId(),
      type: itemType,
      title: isFlight ? flightTitle || title.trim() || 'Flight' : title.trim(),
      startDate: isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString(),
      endDate: existing?.endDate,
      location: composeLocation(),
      confirmation: clean(confirmation),
      notes: clean(notes),
      // Structured booking detail — persisted only for the matching type.
      seat: isFlight ? clean(seat) : undefined,
      cabinClass: isFlight && cabin ? CABIN_LABEL[cabin] : undefined,
      terminal: isFlight ? clean(terminal) : undefined,
      gate: isFlight ? clean(gate) : undefined,
      provider: isFlight ? carrierOf(flightNo) : undefined,
      address: itemType === 'hotel' ? clean(address) : undefined,
      roomType: itemType === 'hotel' ? clean(roomType) : undefined,
      pickupLocation: itemType === 'car' ? clean(pickup) : undefined,
      dropoffLocation: itemType === 'car' ? clean(dropoff) : undefined,
      cost: hasCost ? Math.round(costNum * 100) / 100 : undefined,
      currency: hasCost ? (currency.trim().toUpperCase() || 'USD').slice(0, 3) : undefined,
    };

    if (existing && trip) {
      updateTrip({ ...trip, items: trip.items.map((i) => (i.id === existing.id ? item : i)) });
    } else {
      addItem(tripId, item);
    }
    router.back();
  };

  /** Location string composed from structured fields, falling back to any typed
   *  location so legacy data ("SFO → NRT") is never lost (iOS parity). */
  function composeLocation(): string | undefined {
    const o = origin.trim().toUpperCase();
    const d = dest.trim().toUpperCase();
    switch (itemType) {
      case 'flight':
        return o && d ? `${o} → ${d}` : clean(location);
      case 'hotel':
        return clean(address) ?? clean(location);
      case 'car':
        return clean(pickup) ?? clean(location);
      default:
        return clean(location);
    }
  }

  const showBookingFields = isFlight || itemType === 'hotel' || itemType === 'car';

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader
        title={existing ? 'Edit Item' : 'Add Item'}
        onSave={save}
        saveDisabled={!valid}
      />

      {/* Scan / paste import — fills the form automatically (iOS parity). */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <Button
          title="Scan boarding pass"
          variant="secondary"
          size="md"
          icon={<Ionicons name="scan-outline" size={16} color={palette.bright} />}
          onPress={() => setScannerOpen(true)}
          style={{ flex: 1 }}
        />
        <Button
          title="Paste confirmation"
          variant="secondary"
          size="md"
          icon={<Ionicons name="clipboard-outline" size={16} color={palette.bright} />}
          onPress={() => setPasteOpen(true)}
          style={{ flex: 1 }}
        />
      </View>

      {scanned || importSummary ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          {scanned ? <Badge tone="good" label="Scanned ✓" /> : null}
          {importSummary ? (
            <Text style={[type.caption, { flexShrink: 1 }]}>{importSummary}</Text>
          ) : null}
        </View>
      ) : null}

      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: palette.dim }]}>Type</Text>
          <TypeSelector value={itemType} onChange={setItemType} />
        </View>

        {/* ── Type-revealed sections ── */}
        {isFlight ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <MonoInput
                label="Flight #"
                placeholder="AA100"
                value={flightNo}
                onChangeText={setFlightNo}
                maxLength={8}
                style={{ flex: 1 }}
              />
              <Input
                label="Seat"
                placeholder="14A"
                value={seat}
                onChangeText={setSeat}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={4}
                style={{ width: 96 }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <MonoInput
                label="From"
                placeholder="JFK"
                value={origin}
                onChangeText={setOrigin}
                maxLength={3}
                style={{ flex: 1 }}
                inputStyle={styles.iataInput}
              />
              <Ionicons
                name="arrow-forward"
                size={18}
                color={palette.dim}
                style={{ marginBottom: 15 }}
              />
              <MonoInput
                label="To"
                placeholder="LAX"
                value={dest}
                onChangeText={setDest}
                maxLength={3}
                style={{ flex: 1 }}
                inputStyle={styles.iataInput}
              />
            </View>
            {flightTitle ? (
              <Text style={type.caption}>
                Saves as <Text style={{ color: palette.bright }}>{flightTitle}</Text>
              </Text>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.overline, { color: palette.dim }]}>Cabin</Text>
              <Chips
                options={CABINS}
                value={cabin as Cabin}
                onChange={(c) => setCabin(c === cabin ? '' : c)}
                labelOf={(c) => CABIN_LABEL[c]}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input
                label="Terminal"
                placeholder="4"
                value={terminal}
                onChangeText={setTerminal}
                autoCapitalize="characters"
                style={{ flex: 1 }}
              />
              <Input
                label="Gate"
                placeholder="B27"
                value={gate}
                onChangeText={setGate}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : null}

        {itemType === 'hotel' ? (
          <>
            <Input
              label="Hotel name"
              placeholder="Park Hyatt Tokyo"
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Address"
              placeholder="3-7-1-2 Nishi Shinjuku, Tokyo"
              value={address}
              onChangeText={setAddress}
            />
            <Input
              label="Room type"
              placeholder="King, Suite"
              value={roomType}
              onChangeText={setRoomType}
            />
          </>
        ) : null}

        {itemType === 'car' ? (
          <>
            <Input
              label="Title"
              placeholder="Hertz · Midsize SUV"
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Pickup location"
              placeholder="LAX Rental Car Center"
              value={pickup}
              onChangeText={setPickup}
            />
            <Input
              label="Drop-off location (optional)"
              placeholder="Same as pickup"
              value={dropoff}
              onChangeText={setDropoff}
            />
          </>
        ) : null}

        {!isFlight && itemType !== 'hotel' && itemType !== 'car' ? (
          <>
            <Input
              label="Title"
              placeholder={itemType === 'restaurant' ? 'Dinner — Sukiyabashi Jiro' : 'TeamLab Planets'}
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Location (optional)"
              placeholder="Chuo City, Tokyo"
              value={location}
              onChangeText={setLocation}
            />
          </>
        ) : null}

        {/* ── Booking fields shared by flight / hotel / rental ── */}
        {showBookingFields ? (
          <>
            <Input
              label="Confirmation / PNR"
              placeholder="HXR7QK"
              value={confirmation}
              onChangeText={setConfirmation}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input
                label="Cost (optional)"
                placeholder="0.00"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                style={{ flex: 1 }}
              />
              <Input
                label="Currency"
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                style={{ width: 96 }}
              />
            </View>
          </>
        ) : null}

        {/* ── Common fields ── */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            label={DATE_LABEL[itemType] ?? 'Date'}
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
          <Input
            label="Time (HH:MM)"
            value={time}
            onChangeText={setTime}
            autoCapitalize="none"
            style={{ width: 120 }}
          />
        </View>
        <View>
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Anything worth remembering…"
            placeholderTextColor={palette.faint}
            textAlignVertical="top"
            style={styles.notesInput}
          />
        </View>
      </Card>

      <ScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
      />
      <PasteModal visible={pasteOpen} onClose={() => setPasteOpen(false)} onApply={handlePasted} />
    </Screen>
  );
}

// ── Boarding-pass scanner (full-screen camera modal) ─────────────────────────

/** Full-screen barcode scanner for the PDF417/Aztec/QR on a boarding pass —
 *  port of the iOS BoardingPassScannerView + scanner cover: dim overlay, guide
 *  box, cancel pill, and a one-shot capture guard. `onScanned` returns false
 *  when the payload isn't a boarding pass, which surfaces an inline error and
 *  re-arms the scanner. */
function ScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (raw: string) => boolean;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState<string | null>(null);
  // Fire once per barcode; onBarcodeScanned streams continuously while in frame.
  const handledRef = useRef(false);

  // Fresh state on every presentation (Modal onShow fires once per open), and
  // ask for camera permission right away when it's still undetermined.
  const handleShow = () => {
    handledRef.current = false;
    setScanError(null);
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  };

  const close = () => {
    setScanError(null);
    onClose();
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (data && onScanned(data)) {
      setScanError(null);
      return; // parent closes the modal
    }
    setScanError("That barcode didn't look like a boarding pass — try another.");
    setTimeout(() => {
      handledRef.current = false; // re-arm after a beat so it doesn't spam
    }, 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" onShow={handleShow} onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: palette.ink }}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['pdf417', 'qr', 'aztec'] }}
              onBarcodeScanned={handleBarcode}
            />
            {/* Dim wash with a clear guide window over the camera feed. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.scanDim} />
              <View style={styles.scanRow}>
                <View style={styles.scanDim} />
                <View style={styles.guideBox} />
                <View style={styles.scanDim} />
              </View>
              <View style={[styles.scanDim, { alignItems: 'center', paddingTop: spacing.xl }]}>
                {scanError ? (
                  <Text style={[type.caption, styles.scanError]}>{scanError}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.permissionWrap}>
            <Ionicons name="camera-outline" size={44} color={palette.bright} />
            <Text style={[type.sub, { textAlign: 'center' }]}>Camera access needed</Text>
            <Text style={[type.bodyDim, { textAlign: 'center' }]}>
              Point the camera at the barcode on a paper or wallet boarding pass and the flight
              fills in automatically.
            </Text>
            {permission && !permission.granted && !permission.canAskAgain ? (
              <Text style={[type.caption, { textAlign: 'center' }]}>
                Camera access is off — enable it for JetSetter Pro in Settings, then try again.
              </Text>
            ) : (
              <Button title="Allow camera" size="md" onPress={() => void requestPermission()} />
            )}
          </View>
        )}

        <View style={[styles.scanTopRow, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={close} hitSlop={10} style={styles.scanPill}>
            <Text style={[type.body, { color: '#FFFFFF', fontWeight: '700' }]}>Cancel</Text>
          </Pressable>
          {permission?.granted ? (
            <View style={styles.scanPill}>
              <Ionicons name="scan-outline" size={14} color="#FFFFFF" />
              <Text style={[type.caption, { color: '#FFFFFF', fontWeight: '700' }]}>
                Point at the barcode
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ── Paste-confirmation modal ──────────────────────────────────────────────────

/** Card-style modal with a paste box — port of the iOS PasteConfirmationSheet.
 *  Apply hands the raw text back to the form's best-effort parser. */
function PasteModal({
  visible,
  onClose,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [text, setText] = useState('');

  // Leave the box fresh for next time — cleared on the way out (close/apply)
  // rather than in an effect, so no render-cascading setState.
  const close = () => {
    setText('');
    onClose();
  };

  const apply = () => {
    const pasted = text;
    setText('');
    onApply(pasted);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.pasteBackdrop}
      >
        <Card style={{ gap: spacing.lg }}>
          <Text style={type.sub}>Paste confirmation</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder="Paste your booking confirmation email here…"
            placeholderTextColor={palette.faint}
            textAlignVertical="top"
            style={styles.pasteInput}
          />
          <Text style={type.caption}>
            We&apos;ll pull out the confirmation code, flight, route, date, seat, and price where
            we can — review everything before saving.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Cancel" variant="ghost" size="md" onPress={close} style={{ flex: 1 }} />
            <Button
              title="Apply"
              size="md"
              disabled={!text.trim()}
              onPress={apply}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Small in-file components ──────────────────────────────────────────────────

/** Type selector chips with icons (iOS segmented type picker analog). */
function TypeSelector({
  value,
  onChange,
}: {
  value: ItineraryItemType;
  onChange: (t: ItineraryItemType) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {TYPES.map((t) => {
        const active = t === value;
        const meta = ITINERARY_META[t];
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={[styles.typeChip, active && styles.typeChipActive]}
          >
            <Ionicons
              name={meta.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={active ? palette.bright : palette.dim}
            />
            <Text style={[styles.typeChipText, active && { color: palette.bright }]}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Design-kit-styled input in the monospace face — flight numbers and IATA
 *  codes read like the split-flap board. (The kit `Input` owns its TextInput
 *  style, so mono fields get a local twin.) */
function MonoInput({
  label,
  style,
  inputStyle,
  ...props
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
} & TextInputProps) {
  return (
    <View style={style}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={palette.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        {...props}
        style={[styles.monoInput, inputStyle]}
      />
    </View>
  );
}

// ── Pure helpers (module scope keeps render free of Date construction) ────────

function clean(s: string): string | undefined {
  const t = s.trim();
  return t ? t : undefined;
}

/** "AA100 JFK → LAX" from the structured flight fields. */
function composeFlightTitle(flightNo: string, origin: string, dest: string): string {
  const fn = flightNo.trim().toUpperCase().replace(/\s+/g, '');
  const o = origin.trim().toUpperCase();
  const d = dest.trim().toUpperCase();
  const route = o.length === 3 && d.length === 3 ? `${o} → ${d}` : '';
  return [fn, route].filter(Boolean).join(' ');
}

/** Carrier designator out of "AA100" → "AA" (stored as `provider`). */
function carrierOf(flightNo: string): string | undefined {
  const m = /^([A-Z][A-Z0-9])\s?\d{1,4}[A-Z]?$/i.exec(flightNo.trim());
  return m ? m[1].toUpperCase() : undefined;
}

/** Recovers origin/dest from a stored "JFK → LAX" location when editing. */
function routeOf(item?: ItineraryItem): { origin: string; dest: string } {
  if (item?.type !== 'flight') return { origin: '', dest: '' };
  const m = /^([A-Z]{3})\s*(?:→|->)\s*([A-Z]{3})$/.exec(item.location?.trim() ?? '');
  return m ? { origin: m[1], dest: m[2] } : { origin: '', dest: '' };
}

/** Recovers "AA100" from a composed flight title when editing. */
function flightNoOf(item?: ItineraryItem): string {
  if (!item || item.type !== 'flight') return '';
  const m = /^([A-Z0-9]{2}\s?\d{1,4}[A-Z]?)\b/.exec(item.title.trim().toUpperCase());
  return m ? m[1].replace(/\s+/g, '') : '';
}

function cabinKeyOf(label?: string): Cabin | '' {
  const needle = (label ?? '').trim().toLowerCase();
  return CABINS.find((c) => CABIN_LABEL[c].toLowerCase() === needle) ?? '';
}

/** Local 'YYYY-MM-DD' of a stored ISO datetime (edit prefill). */
function datePartOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10) : toISODate(d);
}

/** Local 'HH:MM' of a stored ISO datetime (edit prefill). */
function timePartOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '09:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const SCAN_DIM = 'rgba(4, 7, 13, 0.55)';

const styles = StyleSheet.create({
  // Field label — matches the kit Input's label exactly.
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.dim,
    marginBottom: 8,
  },
  monoInput: {
    height: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(22,25,41,0.6)',
    color: palette.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    fontFamily: MONO,
    letterSpacing: 1,
  },
  iataInput: { textAlign: 'center', letterSpacing: 3, fontSize: 17 },
  notesInput: {
    minHeight: 84,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(22,25,41,0.6)',
    color: palette.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'transparent',
  },
  typeChipActive: { borderColor: palette.accent, backgroundColor: palette.fillAccent },
  typeChipText: { color: palette.dim, fontWeight: '600', fontSize: 13 },

  // Scanner
  scanDim: { flex: 1, backgroundColor: SCAN_DIM },
  scanRow: { flexDirection: 'row', height: 170 },
  guideBox: {
    width: 300,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: palette.bright,
    backgroundColor: 'transparent',
  },
  scanTopRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanError: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },

  // Paste modal
  pasteBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(4, 6, 12, 0.72)',
  },
  pasteInput: {
    minHeight: 160,
    maxHeight: 260,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(22,25,41,0.6)',
    color: palette.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
});
