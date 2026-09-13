import { SiteFooter } from "@/components/common/SiteFooter";

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 sm:py-16">
      <article className="flex-1 rounded-xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-10">
        <header className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">Effective Date: {effectiveDate}</p>
        </header>
        <div>{children}</div>
      </article>
      <SiteFooter variant="page" />
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">{heading}</h2>
      <div className="space-y-3 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}
