import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { typographyStyles } from "@/lib/typography";

const twMerge = extendTailwindMerge<"typography">({
  extend: {
    classGroups: {
      typography: [...Object.values(typographyStyles), "type-control"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

