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
  archive: string,
  path: string,
  provider: string,
  data: ArrayBuffer,
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

  +activityLabels: { [string]: string };
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

const ProviderLookup = new Map<string, Provider>();
ProviderRegistry.forEach((provider) =>
  ProviderLookup.set(provider.slug, provider)
);

export function getProvider(slug: string): Provider {
  const provider = ProviderLookup.get(slug);
  if (provider === undefined) {
    throw new Error(`No such provider: ${slug}`);
  }
  return provider;
}
