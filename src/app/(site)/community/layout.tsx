export default function CommunityLayout({ children }: LayoutProps<"/community">) {
  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">El anime se disfruta más en compañía</p>
      <h1 className="font-display text-title mt-2">Comunidad</h1>
      {children}
    </div>
  );
}
