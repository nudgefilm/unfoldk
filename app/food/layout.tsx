import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "K-drama Food Recipes & Korean Cooking Guide | KfoodKit by UnfoldK",
  description:
    "Cook the food from your favorite K-dramas anywhere in the world. Korean recipes with local ingredient alternatives.",
  alternates: { canonical: "https://www.unfoldk.com/food" },
  openGraph: {
    title: "K-drama Food Recipes & Korean Cooking Guide | KfoodKit by UnfoldK",
    description:
      "Cook the food from your favorite K-dramas anywhere in the world. Korean recipes with local ingredient alternatives.",
    url: "https://www.unfoldk.com/food",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "K-drama Food Recipes & Korean Cooking Guide | KfoodKit by UnfoldK",
    description:
      "Cook the food from your favorite K-dramas anywhere in the world. Korean recipes with local ingredient alternatives.",
  },
}

export default function FoodLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
