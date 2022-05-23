import type { DataFile, TimelineEntry } from "@src/common/database";
import Amazon from "@src/providers/amazon";
import Apple from "@src/providers/apple";
import Discord from "@src/providers/discord";
import Facebook from "@src/providers/facebook";
import GitHub from "@src/providers/github";
import Google from "@src/providers/google";
import Netflix from "@src/providers/netflix";
import Slack from "@src/providers/slack";

export type TimelineCategory = {
  char: string; // single-character identifier for URLs
  icon: string;
  displayName: string;
  defaultEnabled: boolean;
};

export interface Provider<T> {
  slug: string;
  displayName: string;

  brandColor: string;
  // derived from brandColor by provider.test.js...
  neonColor: string;
  neonColorHDR: string;

  requestLink: { text: string; href: string };
  instructions: ReadonlyArray<string>;
  waitTime: string;
  singleFile: boolean;
  fileName: string;
  privacyPolicy: string;

  timelineCategories: ReadonlyMap<T, TimelineCategory>;

  parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<ReadonlyArray<TimelineEntry<T>>>;

  render?: (
    entry: TimelineEntry<T>,
    metadata: ReadonlyMap<string, any>
  ) =>
    | [JSX.Element, string | void]
    | [
        JSX.Element | void,
        string | void,
        { display: string; color?: string } | void
      ];
}

export const ProviderRegistry: ReadonlyArray<Provider<any>> = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
];

export const ProviderLookup: ReadonlyMap<string, Provider<any>> = new Map<
  string,
  Provider<any>
>();
ProviderRegistry.forEach((provider) =>
  (ProviderLookup as any).set(provider.slug, provider)
);
