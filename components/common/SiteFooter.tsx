import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "home" | "page";

export function SiteFooter({ variant = "page" }: { variant?: Variant }) {
  const wrapperClass =
    variant === "home"
      ? "row-start-3 mb-4 flex flex-col items-center justify-center gap-4"
      : "mt-12 flex flex-col items-center justify-center gap-4 pb-8";
  const linkColor = variant === "home" ? "text-inherit" : "text-white";

  return (
    <footer className={wrapperClass}>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link href="/privacy" className={cn("hover:underline hover:underline-offset-4", linkColor)}>
          Privacy Policy
        </Link>
        <Link href="/terms" className={cn("hover:underline hover:underline-offset-4", linkColor)}>
          Terms
        </Link>
        <a
          className={cn(
            "flex items-center gap-2 hover:underline hover:underline-offset-4",
            linkColor
          )}
          href="https://creativeplatform.xyz"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16} />
          Go to creativeplatform.xyz →
        </a>
      </div>
      <div className="flex">
        <Image
          src="/crossmint-leaf.svg"
          alt="Powered by Crossmint"
          priority
          width={152}
          height={100}
          style={{ height: "auto" }}
        />
      </div>
    </footer>
  );
}
