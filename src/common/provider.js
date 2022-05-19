// @flow
import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Discord from "providers/discord";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";

import type { Node } from "react";
import type { DataFile, TimelineEntry } from "common/database";

export type TimelineCategory = {|
  +char: string, // single-character identifier for URLs
  +icon: string,
  +displayName: string,
  +defaultEnabled: boolean,
|};

export interface Provider<T> {
  +slug: string;
  +displayName: string;

  +brandColor: string;
  // derived from brandColor by provider.test.js...
  +neonColor: string;
  +neonColorHDR: string;

  +requestLink: {| text: string, href: string |};
  +instructions: $ReadOnlyArray<string>;
  +waitTime: string;
  +singleFile: boolean;
  +privacyPolicy: string;

  +metadataFiles: $ReadOnlyArray<string | RegExp>;
  +timelineCategories: $ReadOnlyMap<T, TimelineCategory>;

  parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<$ReadOnlyArray<TimelineEntry<T>>>;

  +render?: (
    entry: TimelineEntry<T>,
    metadata: $ReadOnlyMap<string, any>
  ) =>
    | [?Node, ?string]
    | [?Node, ?string, ?{| display: string, color: ?string |}];
}

export const ProviderRegistry: $ReadOnlyArray<Provider<any>> = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
];

export const ProviderLookup: $ReadOnlyMap<string, Provider<any>> = new Map<
  string,
  Provider<any>
>();
ProviderRegistry.forEach((provider) =>
  (ProviderLookup: any).set(provider.slug, provider)
);
