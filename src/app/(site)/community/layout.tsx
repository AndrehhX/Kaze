export default function CommunityLayout({ children }: LayoutProps<"/community">) {
  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Anime is better together</p>
      <h1 className="font-display text-title mt-2">Community</h1>
      {children}
    </div>
  );
}
