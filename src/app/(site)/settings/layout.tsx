import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Make it yours</p>
      <h1 className="font-display text-title mt-2">Settings</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <SettingsNav />
        </aside>
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
