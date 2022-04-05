// @flow
import * as React from "react";

import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Discord from "providers/discord";
import Facebook from "providers/facebook";
import Generic from "providers/generic";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";

import type { Entry } from "parse";

export type DataFile = {|
  +archive: string,
  +path: string,
  +provider: string,
  +data: ArrayBuffer,
|};

export type TimelineCategory = {|
  +slug: string,
  +char: string, // single-character identifier for URLs
  +displayName: string,
  +defaultEnabled: boolean,
|};

export interface Provider {
  +slug: string;
  +displayName: string;
  +icon: React.Node;
  +color: string;
  +fullColor?: boolean;

  +privacyPolicy: string;
  +waitTime: string;
  +instructions: React.Node;

  +timelineCategories: $ReadOnlyArray<TimelineCategory>;
  +timelineLabels: { [string]: [string, string] };
  +settingLabels: { [string]: string };
  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry>;
}

export const ProviderRegistry: $ReadOnlyArray<Provider> = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
  new Generic(),
];

export const ProviderLookup: $ReadOnlyMap<string, Provider> = new Map<
  string,
  Provider
>();
ProviderRegistry.forEach((provider) =>
  (ProviderLookup: any).set(provider.slug, provider)
);

export function getLiteColor(base: string): string {
  if (!base.startsWith("#")) throw new Error("Can't parse color " + base);
  if (base.length === 4) base = base + base.slice(1);
  if (base.length !== 7) throw new Error("Can't parse color " + base);
  const parsed = [
    parseInt(base.slice(1, 3), 16),
    parseInt(base.slice(3, 5), 16),
    parseInt(base.slice(5, 7), 16),
  ];
  const lite = parsed.map((c) => Math.min(Math.round(192 + c / 4), 255));
  return "#" + lite.map((c) => c.toString(16)).join("");
}
