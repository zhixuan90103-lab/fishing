/**
 * Boot: safe-area → device preview → WebGPU design stage → shore scene.
 * Fishing rules live in docs/FISHING-REQUIREMENTS.md. The cast stages live in src/play/fishing.js.
 * Keep: adapt/*, create-renderer, utils/haptics, DOM contract.
 */

import { Capacitor } from '@capacitor/core';
import { startShore } from './shore/startShore.js';
import {
  DESIGN_HEIGHT,
  DESIGN_SAFE,
  DESIGN_WIDTH,
  applyStageTransform,
  computeStageLayout,
  watchStageLayout,
  type StageLayout,
} from './adapt/design';
import {
  mountDevicePreview,
  type DevicePreviewController,
} from './adapt/devicePreview';
import { applyNativeClass, applySafeAreaCssVars, readSafeAreaInsets } from './adapt/safeArea';
import { showFatal } from './create-renderer';
import { haptics } from './utils/haptics';

const shell = document.getElementById('shell')!;
const viewportEl = document.getElementById('viewport')!;
const stage = document.getElementById('stage')!;
const statusEl = document.getElementById('status');
const logEl = document.getElementById('haptic-log');

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function setLog(text: string): void {
  if (logEl) logEl.textContent = text;
}

async function boot(): Promise<void> {
  applyNativeClass();

  const platform = Capacitor.getPlatform();
  const native = Capacitor.isNativePlatform();

  setStatus(
    `platform: ${platform} | native: ${native}\n` +
      `design: ${DESIGN_WIDTH}×${DESIGN_HEIGHT}\n` +
      `creating WebGPU…`,
  );

  const shore = await startShore(stage, { onStatus: setStatus });

  let latestLayout: StageLayout | null = null;
  let preview: DevicePreviewController;

  const onLayout = (layout: StageLayout) => {
    latestLayout = layout;
    applyStageTransform(stage, layout);
    applySafeAreaCssVars(native);
    shore.resize(DESIGN_WIDTH, DESIGN_HEIGHT);

    const safe = readSafeAreaInsets();
    setStatus(
      `WebGPU OK\n` +
        `platform: ${platform} | native: ${native}\n` +
        `haptics ios: ${haptics.isNativeIos()} · plugin: ${haptics.isPluginAvailable()}\n` +
        `design: ${DESIGN_WIDTH}×${DESIGN_HEIGHT} · scale ${layout.scale.toFixed(3)}\n` +
        `view: ${Math.round(layout.viewWidth)}×${Math.round(layout.viewHeight)}\n` +
        `safe: T${Math.round(safe.top)} R${Math.round(safe.right)} B${Math.round(safe.bottom)} L${Math.round(safe.left)}` +
        (native ? '' : ` · desktop sim (${DESIGN_SAFE.top}/${DESIGN_SAFE.bottom})`),
    );
  };

  preview = mountDevicePreview(shell, viewportEl, () => {
    const size = preview.getViewSize();
    onLayout(computeStageLayout(size.width, size.height, 'contain'));
  });

  const unwatch = watchStageLayout(onLayout, {
    mode: 'contain',
    getViewSize: () => preview.getViewSize(),
  });

  if (new URLSearchParams(window.location.search).has('debugFit')) {
    const log = () => {
      if (latestLayout) {
        console.info('[debugFit]', latestLayout, preview.getDevice());
      }
    };
    window.addEventListener('resize', log);
    log();
  }

  // Optional: document.body.classList.add('debug-safe-area')

  if (haptics.isNativeIos()) {
    setLog(
      `native iOS · plugin=${haptics.isPluginAvailable()}\n` +
        (haptics.isPluginAvailable()
          ? '点「点我震动」应有马达反馈。'
          : '插件未注册：SceneDelegate 必须用 BridgeViewController。'),
    );
  } else {
    setLog(
      '当前不是 iOS App，点按钮不会有原生震动。\n' +
        '请 npm run ios:bootstrap → Xcode 选真机 Run。',
    );
  }

  document.querySelectorAll<HTMLElement>('[data-haptic]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-haptic');
      let result: unknown;
      switch (action) {
        case 'prepare':
          result = await haptics.prepare();
          break;
        case 'tap':
          result = await haptics.playTransient(0.55, 0.5);
          break;
        case 'impact':
          result = await haptics.impact('medium');
          break;
        case 'start':
          result = await haptics.startContinuous({
            intensity: 0.18,
            sharpness: 0.22,
          });
          break;
        case 'stop':
          result = await haptics.stopContinuous();
          break;
        default:
          result = { ok: false, reason: 'unknown' };
      }
      setLog(`${action} → ${JSON.stringify(result)}`);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && haptics.isNativeIos()) {
      void haptics.prepare();
    }
  });

  window.addEventListener(
    'pagehide',
    () => {
      unwatch();
      preview.dispose();
      shore.dispose();
    },
    { once: true },
  );
}

boot().catch((err) => {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  setStatus(`boot failed: ${message}`);
  if (!navigator.gpu) showFatal('WebGPU 不可用', message);
});
