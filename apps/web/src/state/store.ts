import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChartType,
  ConnectionStatus,
  LayoutMode,
  Locale,
  ScaleMode,
  SymbolInfo,
  ThemeName,
  Timeframe,
} from '@trade/core';
import { SYMBOLS } from '@trade/core';
import type { Drawing } from '@trade/drawings';
import { nextZIndex } from '@trade/drawings';
import type { IndicatorParams } from '@trade/indicators';

export interface IndicatorInstance {
  id: string;
  type: string;
  params: IndicatorParams;
  visible: boolean;
}

export interface IndicatorTemplate {
  name: string;
  indicators: IndicatorInstance[];
}

export type AlertKind = 'price-above' | 'price-below' | 'price-cross';

export interface PriceAlert {
  id: string;
  symbol: string;
  kind: AlertKind;
  value: number;
  active: boolean;
  repeat: boolean;
  triggeredAt?: number;
  createdAt: number;
}

export interface PaneState {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
}

export interface ToastMessage {
  id: string;
  text: string;
  kind: 'info' | 'warn' | 'error' | 'success';
}

interface AppState {
  // persisted
  version: number;
  locale: Locale;
  theme: ThemeName;
  layout: LayoutMode;
  activePane: number;
  panes: PaneState[];
  scaleMode: ScaleMode;
  magnet: boolean;
  providerBySymbol: Record<string, string>;
  indicators: IndicatorInstance[];
  indicatorTemplates: IndicatorTemplate[];
  drawings: Drawing[];
  alerts: PriceAlert[];
  settings: {
    twelveDataKey?: string;
    proxyUrl?: string;
    notifications: boolean;
    sound: boolean;
    accountSize: number;
    riskPct: number;
  };

  // ephemeral
  activeTool: string | null;
  selectedDrawingId: string | null;
  status: ConnectionStatus;
  lastTickAt: number | null;
  lastPrice: number | null;
  crosscheckDeviation: number | null;
  crosscheckSecondary: { provider: string; price: number } | null;
  toasts: ToastMessage[];
  editingIndicatorId: string | null;
  showShortcuts: boolean;

  // actions
  setLocale(locale: Locale): void;
  setTheme(theme: ThemeName): void;
  setLayout(layout: LayoutMode): void;
  setActivePane(index: number): void;
  setSymbol(index: number, symbol: string): void;
  setTimeframe(index: number, tf: Timeframe): void;
  setChartType(index: number, type: ChartType): void;
  setScaleMode(mode: ScaleMode): void;
  toggleMagnet(): void;
  setProvider(symbol: string, providerId: string): void;
  addIndicator(type: string, params?: IndicatorParams): void;
  removeIndicator(id: string): void;
  updateIndicator(id: string, params: IndicatorParams): void;
  toggleIndicatorVisible(id: string): void;
  reorderIndicator(id: string, dir: -1 | 1): void;
  saveTemplate(name: string): void;
  applyTemplate(name: string): void;
  deleteTemplate(name: string): void;
  addDrawing(drawing: Drawing): void;
  updateDrawing(id: string, patch: Partial<Drawing>): void;
  removeDrawing(id: string): void;
  duplicateDrawing(id: string): void;
  clearDrawings(symbol: string): void;
  undo(): void;
  redo(): void;
  addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): void;
  removeAlert(id: string): void;
  toggleAlert(id: string): void;
  markAlertTriggered(id: string): void;
  updateSettings(patch: Partial<AppState['settings']>): void;
  setStatus(status: ConnectionStatus, price?: number): void;
  setCrosscheck(
    deviation: number | null,
    secondary: { provider: string; price: number } | null,
  ): void;
  pushToast(text: string, kind?: ToastMessage['kind']): void;
  dismissToast(id: string): void;
  setActiveTool(tool: string | null): void;
  selectDrawing(id: string | null): void;
  setEditingIndicator(id: string | null): void;
  setShowShortcuts(show: boolean): void;
  importState(data: unknown): void;
}

const SCHEMA_VERSION = 3;

function defaultPanes(): PaneState[] {
  return [
    { id: 'p1', symbol: 'BTC/USDT', timeframe: '15m', chartType: 'candles' },
    { id: 'p2', symbol: 'XAU/USD', timeframe: '15m', chartType: 'candles' },
    { id: 'p3', symbol: 'XAUT/USDT', timeframe: '1h', chartType: 'candles' },
    { id: 'p4', symbol: 'BTC/USDT', timeframe: '1h', chartType: 'candles' },
  ];
}

interface HistoryEntry {
  drawings: Drawing[];
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      let undoStack: HistoryEntry[] = [];
      let redoStack: HistoryEntry[] = [];

      const pushHistory = () => {
        undoStack.push({ drawings: [...get().drawings] });
        if (undoStack.length > 50) undoStack.shift();
        redoStack = [];
      };

      return {
        version: SCHEMA_VERSION,
        locale: 'en',
        theme: 'dark',
        layout: 'single',
        activePane: 0,
        panes: defaultPanes(),
        scaleMode: 'linear',
        magnet: true,
        providerBySymbol: {
          'BTC/USDT': 'binance',
          'XAU/USD': 'bybit',
          'XAUT/USDT': 'okx',
        },
        indicators: [],
        indicatorTemplates: [],
        drawings: [],
        alerts: [],
        settings: { notifications: true, sound: true, accountSize: 10000, riskPct: 1 },
        activeTool: null,
        selectedDrawingId: null,
        status: 'loading',
        lastTickAt: null,
        lastPrice: null,
        crosscheckDeviation: null,
        crosscheckSecondary: null,
        toasts: [],
        editingIndicatorId: null,
        showShortcuts: false,

        setLocale: (locale) => set({ locale }),
        setTheme: (theme) => set({ theme }),
        setLayout: (layout) =>
          set({ layout, panes: get().panes.length === 4 ? get().panes : defaultPanes() }),
        setActivePane: (activePane) => set({ activePane }),
        setSymbol: (index, symbol) => {
          const panes = [...get().panes];
          if (panes[index]) panes[index] = { ...panes[index], symbol };
          set({ panes, activePane: index });
        },
        setTimeframe: (index, timeframe) => {
          const panes = [...get().panes];
          if (panes[index]) panes[index] = { ...panes[index], timeframe };
          set({ panes, activePane: index });
        },
        setChartType: (index, chartType) => {
          const panes = [...get().panes];
          if (panes[index]) panes[index] = { ...panes[index], chartType };
          set({ panes, activePane: index });
        },
        setScaleMode: (scaleMode) => set({ scaleMode }),
        toggleMagnet: () => set({ magnet: !get().magnet }),
        setProvider: (symbol, providerId) =>
          set({ providerBySymbol: { ...get().providerBySymbol, [symbol]: providerId } }),

        addIndicator: (type, params) => {
          if (get().indicators.length >= 20) {
            get().pushToast(
              get().locale === 'id' ? 'Maksimal 20 indikator' : 'Maximum of 20 indicators reached',
              'warn',
            );
            return;
          }
          const instance: IndicatorInstance = {
            id: `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
            type,
            params: params ?? {},
            visible: true,
          };
          set({ indicators: [...get().indicators, instance] });
        },
        removeIndicator: (id) => set({ indicators: get().indicators.filter((i) => i.id !== id) }),
        updateIndicator: (id, params) =>
          set({ indicators: get().indicators.map((i) => (i.id === id ? { ...i, params } : i)) }),
        toggleIndicatorVisible: (id) =>
          set({
            indicators: get().indicators.map((i) =>
              i.id === id ? { ...i, visible: !i.visible } : i,
            ),
          }),
        reorderIndicator: (id, dir) => {
          const list = [...get().indicators];
          const idx = list.findIndex((i) => i.id === id);
          const target = idx + dir;
          if (idx < 0 || target < 0 || target >= list.length) return;
          [list[idx], list[target]] = [list[target], list[idx]];
          set({ indicators: list });
        },
        saveTemplate: (name) => {
          const templates = get().indicatorTemplates.filter((t) => t.name !== name);
          set({ indicatorTemplates: [...templates, { name, indicators: get().indicators }] });
        },
        applyTemplate: (name) => {
          const template = get().indicatorTemplates.find((t) => t.name === name);
          if (template) set({ indicators: [...template.indicators] });
        },
        deleteTemplate: (name) =>
          set({ indicatorTemplates: get().indicatorTemplates.filter((t) => t.name !== name) }),

        addDrawing: (drawing) => {
          pushHistory();
          set({ drawings: [...get().drawings, drawing] });
        },
        updateDrawing: (id, patch) => {
          pushHistory();
          set({ drawings: get().drawings.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
        },
        removeDrawing: (id) => {
          pushHistory();
          set({
            drawings: get().drawings.filter((d) => d.id !== id),
            selectedDrawingId: get().selectedDrawingId === id ? null : get().selectedDrawingId,
          });
        },
        duplicateDrawing: (id) => {
          const source = get().drawings.find((d) => d.id === id);
          if (!source) return;
          pushHistory();
          const copy: Drawing = {
            ...source,
            id: `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
            zIndex: nextZIndex(get().drawings),
          };
          set({ drawings: [...get().drawings, copy] });
        },
        clearDrawings: (symbol) => {
          pushHistory();
          set({ drawings: get().drawings.filter((d) => d.symbol !== symbol) });
        },
        undo: () => {
          if (undoStack.length === 0) return;
          const prev = undoStack.pop() as HistoryEntry;
          redoStack.push({ drawings: [...get().drawings] });
          set({ drawings: prev.drawings });
        },
        redo: () => {
          if (redoStack.length === 0) return;
          const next = redoStack.pop() as HistoryEntry;
          undoStack.push({ drawings: [...get().drawings] });
          set({ drawings: next.drawings });
        },

        addAlert: (alert) =>
          set({
            alerts: [
              ...get().alerts,
              { ...alert, id: `a${Date.now().toString(36)}`, createdAt: Date.now() },
            ],
          }),
        removeAlert: (id) => set({ alerts: get().alerts.filter((a) => a.id !== id) }),
        toggleAlert: (id) =>
          set({ alerts: get().alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)) }),
        markAlertTriggered: (id) =>
          set({
            alerts: get().alerts.map((a) =>
              a.id === id ? { ...a, active: a.repeat, triggeredAt: Date.now() } : a,
            ),
          }),

        updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
        setStatus: (status, price) =>
          set({
            status,
            ...(price !== undefined ? { lastPrice: price, lastTickAt: Date.now() } : {}),
          }),
        setCrosscheck: (deviation, secondary) =>
          set({ crosscheckDeviation: deviation, crosscheckSecondary: secondary }),
        pushToast: (text, kind = 'info') => {
          const toast: ToastMessage = {
            id: `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
            text,
            kind,
          };
          set({ toasts: [...get().toasts.slice(-4), toast] });
          setTimeout(() => get().dismissToast(toast.id), 6000);
        },
        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
        setActiveTool: (activeTool) => set({ activeTool, selectedDrawingId: null }),
        selectDrawing: (selectedDrawingId) => set({ selectedDrawingId }),
        setEditingIndicator: (editingIndicatorId) => set({ editingIndicatorId }),
        setShowShortcuts: (showShortcuts) => set({ showShortcuts }),

        importState: (data) => {
          if (typeof data !== 'object' || data === null) return;
          const incoming = data as Partial<AppState>;
          const safeKeys = [
            'locale',
            'theme',
            'layout',
            'scaleMode',
            'magnet',
            'providerBySymbol',
            'indicators',
            'indicatorTemplates',
            'drawings',
            'alerts',
            'settings',
            'panes',
            'activePane',
          ] as const;
          const patch: Partial<AppState> = {};
          for (const key of safeKeys) {
            if (incoming[key] !== undefined) {
              (patch as Record<string, unknown>)[key] = incoming[key];
            }
          }
          if (!Array.isArray(patch.panes) || patch.panes.length === 0) delete patch.panes;
          if (!Array.isArray(patch.drawings)) delete patch.drawings;
          set(patch);
        },
      };
    },
    {
      name: 'trade.state',
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        version: state.version,
        locale: state.locale,
        theme: state.theme,
        layout: state.layout,
        activePane: state.activePane,
        panes: state.panes,
        scaleMode: state.scaleMode,
        magnet: state.magnet,
        providerBySymbol: state.providerBySymbol,
        indicators: state.indicators,
        indicatorTemplates: state.indicatorTemplates,
        drawings: state.drawings,
        alerts: state.alerts,
        settings: state.settings,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < SCHEMA_VERSION) {
          if (!Array.isArray(state.panes)) state.panes = defaultPanes();
          if (typeof state.providerBySymbol !== 'object' || state.providerBySymbol === null) {
            state.providerBySymbol = {};
          }
          if (!Array.isArray(state.indicators)) state.indicators = [];
          if (!Array.isArray(state.drawings)) state.drawings = [];
          if (!Array.isArray(state.alerts)) state.alerts = [];
        }
        return state as AppState;
      },
    },
  ),
);

export function symbolInfo(id: string): SymbolInfo {
  return SYMBOLS.find((s) => s.id === id) ?? SYMBOLS[0];
}
