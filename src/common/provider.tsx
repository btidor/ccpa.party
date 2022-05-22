import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Discord from "providers/discord";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";

import type { DataFile, TimelineEntry } from "common/database";

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

  metadataFiles: ReadonlyArray<string | RegExp>;
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
