import type { TimelineEntry } from "@src/common/database";
import {
  IgnoreParser,
  MetadataParser,
  TimelineParser,
} from "@src/common/parse";
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
  timelineParsers: ReadonlyArray<TimelineParser<T>>;
  metadataParsers?: ReadonlyArray<MetadataParser>;
  ignoreParsers?: ReadonlyArray<IgnoreParser>;

  render?: (
    entry: TimelineEntry<T>,
    metadata: ReadonlyMap<string, unknown>
  ) =>
    | void
    | [JSX.Element, string | void]
    | [
        JSX.Element | void,
        string | void,
        { display: string; color?: string } | void
      ];
}

export const ProviderRegistry: ReadonlyArray<Provider<unknown>> = [
  new Amazon(),
  new Apple(),
  new Discord() as Provider<unknown>,
  new Facebook(),
  new GitHub(),
  new Google() as Provider<unknown>,
  new Netflix(),
  new Slack() as Provider<unknown>,
];

export const ProviderLookup: ReadonlyMap<string, Provider<unknown>> = new Map<
  string,
  Provider<unknown>
>();
ProviderRegistry.forEach((provider) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ProviderLookup as any).set(provider.slug, provider)
);
