export const DOCS_LAYOUT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.mdocs-root {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background: rgb(var(--bg-main));
  color: rgb(var(--text-primary));
  font-family: Inter, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif;
}
.mdocs-emoji {
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  line-height: 1;
}
.mdocs-tint-blue { background: rgb(var(--google-blue) / 0.14); color: rgb(var(--google-blue)); border: 1px solid rgb(var(--google-blue) / 0.25); }
.mdocs-tint-green { background: rgb(var(--google-green) / 0.14); color: rgb(var(--google-green)); border: 1px solid rgb(var(--google-green) / 0.25); }
.mdocs-tint-yellow { background: rgb(var(--google-yellow) / 0.16); color: rgb(var(--google-yellow)); border: 1px solid rgb(var(--google-yellow) / 0.28); }
.mdocs-tint-red { background: rgb(var(--google-red) / 0.14); color: rgb(var(--google-red)); border: 1px solid rgb(var(--google-red) / 0.25); }
.mdocs-tint-info { background: rgb(var(--info) / 0.14); color: rgb(var(--info)); border: 1px solid rgb(var(--info) / 0.25); }
@keyframes mdocs-scan-sweep {
  0% { transform: translateY(-20%); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateY(340%); opacity: 0; }
}
@keyframes mdocs-line-write {
  0% { width: 12%; opacity: 0.35; }
  50% { width: 100%; opacity: 0.9; }
  100% { width: 12%; opacity: 0.35; }
}
@keyframes mdocs-caret-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes mdocs-card-ready-pulse {
  0% {
    transform: scale(0.97);
    box-shadow: 0 0 0 0 rgb(var(--accent) / 0.45);
  }
  45% {
    transform: scale(1.015);
    box-shadow: 0 0 0 5px rgb(var(--accent) / 0.22);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 2px rgb(var(--accent) / 0.16);
  }
}
.mdocs-card-ready {
  animation: mdocs-card-ready-pulse 1.1s cubic-bezier(0.22, 1, 0.36, 1) 2;
  border: 1px solid rgb(var(--accent) / 0.45);
}
.mdocs-scan-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 76px;
  background: linear-gradient(180deg, transparent 0%, rgb(var(--accent) / 0.14) 50%, transparent 100%);
  pointer-events: none;
  animation: mdocs-scan-sweep 2.8s ease-in-out infinite;
}
.mdocs-write-line {
  height: 7px;
  border-radius: 999px;
  background: rgb(var(--text-muted) / 0.24);
  animation: mdocs-line-write 2.4s ease-in-out infinite;
}
.mdocs-caret {
  display: inline-block;
  width: 2px;
  height: 11px;
  border-radius: 1px;
  background: rgb(var(--accent));
  animation: mdocs-caret-blink 0.9s steps(1, end) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .mdocs-scan-beam, .mdocs-write-line, .mdocs-caret { animation: none !important; }
}
.mdocs-sidebar {
  width: 224px;
  flex-shrink: 0;
  background: rgb(var(--bg-sidebar));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  overflow-y: auto;
}
.mdocs-main {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mdocs-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  background: rgb(var(--bg-main));
  flex-wrap: nowrap;
}
.mdocs-model-card {
  position: relative;
  overflow: hidden;
  min-height: 152px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  isolation: isolate;
  transform: translateZ(0);
}
.mdocs-model-card-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale3d(1, 1, 1);
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
  backface-visibility: hidden;
  pointer-events: none;
}
.mdocs-model-card:hover .mdocs-model-card-bg {
  transform: scale3d(1.08, 1.08, 1);
}
.mdocs-model-card-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.42) 0%, rgba(15, 23, 42, 0.22) 45%, rgba(15, 23, 42, 0.75) 100%);
  pointer-events: none;
}
.mdocs-scroll {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
}
.mdocs-container {
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.mdocs-featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.mdocs-featured-extra {
  display: flex;
}
@media (max-width: 1180px) {
  .mdocs-featured-extra {
    display: none !important;
  }
}
.mdocs-projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.mdocs-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}
.mdocs-ws-body {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.mdocs-ws-primary {
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mdocs-ws-primary-panels {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.mdocs-ws-windowed-tabs {
  display: none;
  flex-shrink: 0;
  padding: 8px 12px;
  gap: 6px;
  background: rgb(var(--bg-sidebar));
}
.mdocs-ws-sources-topbar {
  display: none;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  background: rgb(var(--bg-sidebar));
  border-bottom: 1px solid rgb(var(--border-color));
  position: relative;
}
.mdocs-ws-left {
  width: clamp(200px, 22vw, 300px);
  flex-shrink: 0;
  background: rgb(var(--bg-sidebar));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mdocs-ws-center {
  flex: 1 1 0%;
  min-width: 300px;
  background: rgb(var(--bg-main));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mdocs-ws-right {
  width: clamp(296px, 30vw, 400px);
  flex-shrink: 0;
  background: rgb(var(--bg-sidebar));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mdocs-ws-mobile-tabs {
  display: none;
  flex-shrink: 0;
  padding: 8px 16px;
  gap: 6px;
  background: rgb(var(--bg-sidebar));
}
.mdocs-split-2 {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
  gap: 20px;
  height: 100%;
}
.mdocs-export-grid {
  flex: 1 1 0%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
  overflow: hidden;
}
@media (max-width: 920px) and (min-width: 721px) {
  .mdocs-ws-windowed-tabs {
    display: none;
  }
  .mdocs-ws-sources-topbar {
    display: flex;
  }
  .mdocs-ws-left {
    display: none !important;
  }
  .mdocs-ws-center {
    width: auto;
    min-width: 0;
    flex: 1 1 0%;
    display: flex !important;
    border-right: none;
  }
  .mdocs-ws-right {
    width: 280px;
    display: flex !important;
  }
  .mdocs-chat-chip-extra {
    display: none !important;
  }
}
@media (max-width: 720px) {
  .mdocs-ws-mobile-tabs {
    display: flex;
  }
  .mdocs-ws-left,
  .mdocs-ws-center,
  .mdocs-ws-right {
    width: 100%;
    border-left: none;
    border-right: none;
  }
  .mdocs-ws-hidden-mobile {
    display: none !important;
  }
  .mdocs-split-2,
  .mdocs-export-grid {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .mdocs-sidebar {
    display: none;
  }
  .mdocs-topbar {
    padding: 10px 14px;
  }
  .mdocs-scroll {
    padding: 16px;
  }
}
.mdocs-no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.mdocs-no-scrollbar::-webkit-scrollbar {
  display: none;
}
.mdocs-config-backdrop,
.mdocs-preview-backdrop {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgb(var(--bg-main));
  padding: 0;
}
.mdocs-preview-backdrop {
  z-index: 60;
}
.mdocs-config-dialog,
.mdocs-preview-dialog {
  width: 100%;
  height: 100%;
  background: rgb(var(--bg-main));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  border-radius: 0;
}
.mdocs-config-dialog {
  padding: 24px;
  gap: 16px;
  overflow-y: auto;
}
@media (min-width: 1120px) {
  .mdocs-config-backdrop,
  .mdocs-preview-backdrop {
    align-items: center;
    justify-content: center;
    background: rgb(var(--bg-main) / 0.78);
    backdrop-filter: blur(8px);
    padding: 24px;
  }
  .mdocs-config-dialog {
    width: min(1040px, 92%);
    height: auto;
    max-height: 82vh;
    background: rgb(var(--bg-card));
    border: 1px solid rgb(var(--border-color));
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }
  .mdocs-preview-dialog {
    width: min(960px, 90%);
    height: auto;
    max-height: 86vh;
    background: rgb(var(--bg-card));
    border: 1px solid rgb(var(--border-color));
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }
}
.mdocs-demo-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 24px;
  align-items: center;
}
.mdocs-demo-mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.mdocs-demo-pillars-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 920px) {
  .mdocs-demo-hero-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 780px) {
  .mdocs-demo-pillars-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.mdocs-demo-marketing {
  font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
}
.mdocs-demo-marketing .mdocs-model-card {
  min-height: 184px;
}
.mdocs-demo-display {
  font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
  letter-spacing: -0.028em;
  line-height: 1.15;
}
.mdocs-demo-top-title {
  font-size: clamp(1.45rem, 2.5vw, 1.95rem);
  line-height: 1.15;
}
.mdocs-demo-hero-title {
  font-size: clamp(1.6rem, 2.8vw, 2.15rem);
  line-height: 1.14;
}
.mdocs-demo-brand-title {
  font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
  font-size: clamp(1rem, 1.45vw, 1.25rem);
  letter-spacing: -0.022em;
  line-height: 1.2;
}
.mdocs-demo-section-title {
  font-size: clamp(1.22rem, 2vw, 1.6rem);
  line-height: 1.2;
}
.mdocs-demo-showcase-panel {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  border: none;
  background:
    linear-gradient(155deg, rgb(var(--google-blue) / 0.08) 0%, rgb(var(--accent) / 0.05) 55%, rgb(var(--bg-card)) 100%);
}
.mdocs-demo-spotlight-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: none;
  background:
    linear-gradient(125deg, rgb(var(--google-blue) / 0.11) 0%, rgb(var(--accent) / 0.08) 48%, rgb(var(--bg-card)) 100%);
  transition: transform 0.2s ease;
}
.mdocs-demo-spotlight-card:hover {
  transform: translateY(-1px);
}
.mdocs-demo-mini-card {
  background: rgb(var(--bg-card));
  border: 1px solid rgb(var(--border-color));
  border-radius: 12px;
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.mdocs-demo-mini-card:hover {
  border-color: rgb(var(--accent) / 0.55);
  transform: translateY(-1px);
}
.mdocs-demo-mini-card-active {
  background: linear-gradient(135deg, rgb(var(--google-blue) / 0.12) 0%, rgb(var(--bg-card)) 100%);
  border: 1.5px solid rgb(var(--google-blue) / 0.55);
  border-radius: 12px;
  box-shadow: 0 6px 18px -10px rgb(var(--google-blue) / 0.45);
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.mdocs-demo-mini-card-active:hover {
  border-color: rgb(var(--google-blue));
  transform: translateY(-1px);
}
.mdocs-demo-title-grad {
  background: linear-gradient(120deg, rgb(var(--text-primary)) 0%, rgb(var(--text-primary)) 45%, rgb(var(--google-blue)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.mdocs-demo-serif-em {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: 1.18em;
  letter-spacing: -0.01em;
  background: linear-gradient(120deg, rgb(var(--accent)) 0%, rgb(var(--google-blue)) 60%, rgb(var(--info)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.mdocs-demo-word-blue { color: rgb(var(--google-blue)); font-weight: 600; }
.mdocs-demo-word-green { color: rgb(var(--google-green)); font-weight: 600; }
.mdocs-demo-word-accent { color: rgb(var(--accent)); font-weight: 600; }
.mdocs-demo-word-info { color: rgb(var(--info)); font-weight: 600; }
.mdocs-demo-hero-card {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 100% 0%, rgb(var(--accent) / 0.12) 0%, transparent 58%),
    rgb(var(--bg-card));
}
.mdocs-demo-price-balloon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgb(var(--accent) / 0.14);
  border: 1px solid rgb(var(--accent) / 0.35);
  box-shadow: 0 10px 26px -10px rgb(var(--accent) / 0.45);
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.mdocs-demo-price-balloon:hover {
  transform: translateY(-1px);
  background: rgb(var(--accent) / 0.2);
}
.mdocs-demo-cta-glow {
  box-shadow: 0 10px 24px -8px rgba(196, 215, 250, 0.85);
}
.mdocs-root .mdocs-demo-btn-primary {
  background-color: #C4D7FA;
  border: 1px solid #AEC7F7;
  color: #1E3A8A;
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-weight: 700;
  font-size: 0.88rem;
  line-height: 1.1;
  letter-spacing: 0.01em;
  transition: filter 0.15s ease, opacity 0.15s ease;
}
.mdocs-root .mdocs-demo-btn-primary:hover:not(:disabled) {
  filter: brightness(0.95);
}
@keyframes mdocs-chat-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-3px); opacity: 1; }
}
@keyframes mdocs-chat-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.mdocs-chat-msg-in {
  animation: mdocs-chat-fade-in 0.22s ease-out both;
}
.mdocs-chat-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgb(var(--google-blue));
  display: inline-block;
  animation: mdocs-chat-bounce 1.1s infinite ease-in-out;
}
.mdocs-chat-dot:nth-child(2) { animation-delay: 0.16s; }
.mdocs-chat-dot:nth-child(3) { animation-delay: 0.32s; }
@media (prefers-reduced-motion: reduce) {
  .mdocs-chat-msg-in, .mdocs-chat-dot { animation: none !important; }
}
`
