import { ArrowUpRight, Lock, Monitor, Palette, ShieldCheck } from 'lucide-react';
import type { ServiceItem } from '../lib/types';
import {
  ALL_SHADER_PRESETS,
  type AppearanceSettings,
} from '../lib/appearance';
import { getRuntimeSummary } from '../lib/tauri';
import { THEME_OPTIONS } from '../lib/workbench';

interface SettingsViewProps {
  appearance: AppearanceSettings;
  services: ServiceItem[];
  onOpenDesignStudio: () => void;
}

export function SettingsView({
  appearance,
  services,
  onOpenDesignStudio,
}: SettingsViewProps) {
  const themeLabel =
    THEME_OPTIONS.find((t) => t.id === appearance.theme)?.label ?? appearance.theme;
  const shaderLabel =
    ALL_SHADER_PRESETS.find((s) => s.id === appearance.shader)?.label ?? appearance.shader;
  const runtime = getRuntimeSummary();

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1
          className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
          style={{ color: 'var(--l-text)' }}
        >
          Settings
        </h1>
        <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
          Safety rules, Tauri desktop runtime configuration, and connected workspace services.
        </p>
      </header>

      {/* Consolidated Appearance Pointer to Design Studio */}
      <section className="mb-8" aria-labelledby="settings-appearance-heading">
        <h2
          id="settings-appearance-heading"
          className="mb-3 text-[15px] font-semibold"
          style={{ color: 'var(--l-text)' }}
        >
          Appearance &amp; shell customization
        </h2>
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] border p-4"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border"
              style={{
                backgroundColor: 'var(--l-raised)',
                borderColor: 'var(--l-line-strong)',
                color: 'var(--l-accent)',
              }}
            >
              <Palette size={17} />
            </span>
            <div>
              <p className="m-0 text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Managed in Design Studio
              </p>
              <p className="mt-0.5 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                {themeLabel} · {shaderLabel} · {appearance.pinnedRailPlaces.length} pinned rail tools
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDesignStudio}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-medium whitespace-nowrap"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            <span>Open Design Studio</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </section>

      {/* Desktop & Tauri Runtime */}
      <section className="mb-8" aria-labelledby="settings-desktop-heading">
        <h2
          id="settings-desktop-heading"
          className="mb-3 text-[15px] font-semibold"
          style={{ color: 'var(--l-text)' }}
        >
          Desktop &amp; Tauri runtime
        </h2>
        <div
          className="divide-y rounded-[12px] border"
          style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
        >
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderColor: 'var(--l-line)' }}>
            <Monitor size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--l-accent)' }} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--l-text)' }}>
                {runtime.label}
              </p>
              <p className="mt-0.5 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                Desktop shell with steady scrolling, a draggable titlebar, and a direct local connection to your workspace.
              </p>
              <p className="mt-1.5 mb-0 font-mono text-[12px]" style={{ color: 'var(--l-muted)' }}>
                API transport: {runtime.apiBase}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety floor & privacy */}
      <section className="mb-8" aria-labelledby="settings-safety-heading">
        <h2
          id="settings-safety-heading"
          className="mb-3 text-[15px] font-semibold"
          style={{ color: 'var(--l-text)' }}
        >
          Privacy &amp; safety floor
        </h2>
        <div
          className="divide-y rounded-[12px] border"
          style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
        >
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderColor: 'var(--l-line)' }}>
            <Lock size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--l-accent)' }} />
            <div>
              <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--l-text)' }}>
                Private lanes stay local-only
              </p>
              <p className="mt-0.5 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                Enforced in the Threads &amp; Lanes API: private lanes lock to Qwen local models, hide files from the shared Library, and reject bot access.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderColor: 'var(--l-line)' }}>
            <ShieldCheck size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--l-ok)' }} />
            <div>
              <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--l-text)' }}>
                Always-ask floor
              </p>
              <p className="mt-0.5 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                Force pushes, destructive deletes, and pushes to remote branches always route to Needs you regardless of a lane&apos;s approval level.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section aria-labelledby="settings-services-heading">
        <h2
          id="settings-services-heading"
          className="mb-3 text-[15px] font-semibold"
          style={{ color: 'var(--l-text)' }}
        >
          Services
        </h2>
        <div
          className="divide-y rounded-[12px] border"
          style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
        >
          {services.map((svc) => (
            <div
              key={svc.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              style={{ borderColor: 'var(--l-line)' }}
            >
              <div>
                <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--l-text)' }}>
                  {svc.name}
                </p>
                <p className="mt-0.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  {svc.endpoint} · {svc.detail}
                </p>
              </div>
              <span
                className="text-[12px] font-medium tabular-nums"
                style={{
                  color:
                    svc.status === 'healthy'
                      ? 'var(--l-ok)'
                      : svc.status === 'degraded'
                        ? 'var(--l-needs)'
                        : 'var(--l-bad)',
                }}
              >
                {svc.status === 'healthy'
                  ? `Healthy · ${svc.latencyMs}ms`
                  : svc.status === 'degraded'
                    ? `Degraded · ${svc.latencyMs}ms`
                    : 'Paused'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
