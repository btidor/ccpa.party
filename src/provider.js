// @flow
import Color from "colorjs.io";
import pako from "pako";
import * as React from "react";
import untar from "js-untar";
import { unzip } from "unzipit";

import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Discord from "providers/discord";
import Facebook from "providers/facebook";
import Generic from "providers/generic";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";

import type { Database, DataFile, Entry, TimelineEntry } from "database";

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
  +darkColor?: string;

  +requestLink: {| text: string, href: string |};
  +instructions: $ReadOnlyArray<string>;
  +waitTime: string;
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
  new Generic(),
];

export const ProviderLookup: $ReadOnlyMap<string, Provider> = new Map<
  string,
  Provider
>();
ProviderRegistry.forEach((provider) =>
  (ProviderLookup: any).set(provider.slug, provider)
);

const white = new Color("#fff");

export function lightColor(provider: Provider): string {
  return new Color(provider.color).mix(white, 0.75).toString({ format: "hex" });
}

export function darkColor(provider: Provider): string {
  const color = new Color(provider.darkColor || provider.color)
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

export const fileSizeLimitMB = 16;

export async function importFiles(
  db: Database,
  provider: Provider,
  files: $ReadOnlyArray<File>,
  setProgress: (number | boolean) => void
) {
  type ImportFile = {|
    path: $ReadOnlyArray<string>,
    data: () => Promise<ArrayBuffer>,
  |};

  const work: Array<ImportFile> = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    work.push({ path: [file.name], data: () => file.arrayBuffer() });
  }
  if (work.length < 1) {
    return;
  }

  setProgress(0);
  let processed = 0;
  const processEntry = async (
    path: $ReadOnlyArray<string>,
    data: ArrayBuffer
  ): Promise<?ImportFile> => {
    if (processed % 23 === 0) {
      setProgress(processed);
    }
    if (
      path.slice(-1)[0].endsWith(".zip") ||
      path.slice(-1)[0].endsWith(".tar.gz")
    ) {
      return ({ path, data: () => Promise.resolve(data) }: ImportFile);
    } else if (data.byteLength > (2 << 20) * fileSizeLimitMB) {
      const dataFile = ({
        provider: provider.slug,
        path,
        data: undefined,
        skipped: "tooLarge",
      }: DataFile);
      await db.putFile(dataFile);
      processed++;
      return;
    } else {
      const dataFile = ({
        provider: provider.slug,
        path,
        data,
        skipped: undefined,
      }: DataFile);
      await db.putFile(dataFile);
      const parsed = await provider.parse(dataFile);
      for (const entry of parsed) {
        if (entry.type === "metadata") await db.putMetadata(entry);
        else if (entry.type === "timeline") await db.putTimelineEntry(entry);
        processed++;
      }
      return;
    }
  };

  for (const { path, data } of work) {
    if (path.slice(-1)[0].endsWith(".zip")) {
      const zip = await unzip(await data());
      for (const entry of (Object.values(zip.entries || []): any)) {
        if (entry.isDirectory) continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        const next = await processEntry(subpath, await entry.arrayBuffer());
        if (next) work.push(next);
      }
    } else if (path.slice(-1)[0].endsWith(".tar.gz")) {
      const inflated = pako.inflate(await data());
      const entries = await untar(inflated.buffer);
      for (const entry of entries) {
        if (entry.type !== "0") continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        const next = await processEntry(subpath, entry.buffer);
        if (next) work.push(next);
      }
    } else {
      throw new Error("Unknown archive: " + path.slice(-1)[0]);
    }
  }
  setProgress(true);
}
