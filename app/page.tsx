import { HomeContent } from "@/app/home";
import { SiteFooter } from "@/components/common/SiteFooter";

export default function Home() {
  return (
    <div className="grid h-screen items-center">
      <main className="row-start-2 flex h-full flex-col items-center gap-8 sm:items-start">
        <HomeContent />
      </main>
      <SiteFooter variant="home" />
    </div>
  );
}
