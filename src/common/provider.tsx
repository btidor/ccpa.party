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
}

export const ProviderRegistry: ReadonlyArray<Provider<unknown>> = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
];

export const ProviderLookup: ReadonlyMap<string, Provider<unknown>> = new Map(
  ProviderRegistry.map((p) => [p.slug, p]),
);
