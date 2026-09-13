"use client";

import { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { Container } from "./common/Container";

const newProducts: NewProductProps[] = [
  {
    title: "Earn Yield",
    description: "Earn up to 5% APR",
    image: "/earn-yield.png",
    ctaLabel: "Go to Vaults",
    ctaHref: "/strategies",
  },
  {
    title: "Access Benefits",
    description: "Health, retirement, and tax benefits",
    image: "/benefits.png",
    ctaLabel: "Access Benefits",
    ctaHref: "https://partner.opolis.co/CreativeOrganizationDao",
  },
  {
    title: "Get Your Card",
    description: "Set up a card to start using your funds",
    image: "/creative_platform_card.png",
  },
  {
    title: "Lending/Borrowing",
    description: "Borrow without having to sell your crypto",
    image: "/5901923.png",
    ctaLabel: "Go to Lending",
    ctaHref: "/lending",
  },
];

interface NewProductProps {
  title: string;
  description: string;
  image: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const NewProduct = ({ title, description, image, ctaLabel, ctaHref }: NewProductProps) => {
  const router = useRouter();

  const handleNavigate = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!ctaHref) {
      return;
    }
    router.push(ctaHref);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!ctaHref) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(ctaHref);
    }
  };

  return (
    <Container className="flex flex-1 justify-between">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex flex-col justify-center">
          <img className="h-12 w-12 object-contain" src={image} alt={title} />
        </div>
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="text-sm text-slate-600">{description}</div>
        </div>
      </div>
      <div className="flex flex-col items-end justify-start md:justify-center">
        {ctaHref ? (
          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            tabIndex={0}
            aria-label={`Navigate to ${title}`}
            onClick={handleNavigate}
            onKeyDown={handleKeyDown}
          >
            {ctaLabel}
          </button>
        ) : (
          <div className="bg-muted text-muted-foreground min-w-[92px] rounded-3xl px-2 py-1 text-xs font-medium">
            Coming Soon
          </div>
        )}
      </div>
    </Container>
  );
};

export function NewProducts() {
  // Split products into rows of 2
  const rows: NewProductProps[][] = [];
  for (let i = 0; i < newProducts.length; i += 2) {
    rows.push(newProducts.slice(i, i + 2));
  }

  return (
    <div className="my-2 flex flex-col gap-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-col gap-2 md:flex-row">
          {row.map((product) => (
            <NewProduct key={product.title} {...product} />
          ))}
        </div>
      ))}
    </div>
  );
}
