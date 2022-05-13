// @flow
import Color from "colorjs.io";
import * as React from "react";

import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Discord from "providers/discord";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";

import type { DataFile, Entry, TimelineEntry } from "common/database";

export type TimelineCategory = {|
  +slug: string,
  +char: string, // single-character identifier for URLs
  +displayName: string,
  +defaultEnabled: boolean,
|};

export interface Provider {
  +slug: string;
  +displayName: string;
  +color: string;

  +requestLink: {| text: string, href: string |};
  +instructions: $ReadOnlyArray<string>;
  +waitTime: string;
  +singleFile: boolean;
  +privacyPolicy: string;

  +timelineCategories: $ReadOnlyArray<TimelineCategory>;

  parse(file: DataFile): Promise<$ReadOnlyArray<Entry>>;
  render(entry: TimelineEntry, metadata: $ReadOnlyMap<string, any>): React.Node;
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
];

export const ProviderLookup: $ReadOnlyMap<string, Provider> = new Map<
  string,
  Provider
>();
ProviderRegistry.forEach((provider) =>
  (ProviderLookup: any).set(provider.slug, provider)
);

export function darkColor(provider: Provider): string {
  const color = new Color(provider.color)
    .to("rec2020")
    .toGamut({ space: "rec2020" })
    .set("lightness", 65)
    .set("chroma", 132);
  // $FlowFixMe[cannot-resolve-name]
  if (CSS.supports("color", color.toString())) return color.toString();

  return color
    .to("srgb")
    .toGamut({ method: "clip", space: "srgb" })
    .toString({ format: "hex" });
}
