import type { MDXComponents } from "mdx/types";
import {
  ArchiveLink,
  ArticleChapter,
  CardCollection,
  LoreCard,
} from "./app/components/encyclopedia-components";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ArchiveLink,
    ArticleChapter,
    CardCollection,
    LoreCard,
    ...components,
  };
}
