// @flow
import { DateTime } from "luxon";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  getSlugAndDayTime,
  parseCSV,
  parseJSON,
  smartDecode,
} from "common/parse";
import { Pill } from "components/Record";

import type { DataFile, TimelineContext, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

type CategoryKey = "activity" | "message";

class Discord implements Provider<CategoryKey> {
  slug: string = "discord";
  displayName: string = "Discord";

  brandColor: string = "#5865f2";
  neonColor: string = "#4087ff";
  neonColorHDR: string = "color(rec2020 0.4889 0.52224 1.46496)";

  requestLink: {| href: string, text: string |} = {
    text: "Discord",
    href: "https://discord.com/app",
  };
  waitTime: string = "about a week";
  instructions: $ReadOnlyArray<string> = [
    "open User Settings",
    "Privacy & Safety tab",
    "scroll down",
  ];
  singleFile: boolean = true;
  privacyPolicy: string =
    "https://discord.com/privacy#information-for-california-users";

  metadataFiles: $ReadOnlyArray<string | RegExp> = [
    "servers/index.json",
    /^channels\/c[0-9]+\/channel.json/,
  ];

  timelineCategories: $ReadOnlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "activity",
      {
        char: "a",
        icon: "🖱",
        displayName: "Activity",
        defaultEnabled: false,
      },
    ],
    [
      "message",
      {
        char: "m",
        icon: "💬",
        displayName: "Sent Messages",
        defaultEnabled: true,
      },
    ],
  ]);

  async parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<$ReadOnlyArray<TimelineEntry<CategoryKey>>> {
    const entry = (
      row: any,
      category: CategoryKey,
      datetime: any,
      context: TimelineContext
    ) => ({
      file: file.path,
      category,
      ...getSlugAndDayTime(datetime.toSeconds(), row),
      context,
      value: row,
    });

    if (file.path.slice(1).join("/") === "servers/index.json") {
      metadata.set("servers", parseJSON(file.data));
      console.warn("SERVERS", metadata);
    } else if (file.path.slice(-1)[0] === "channel.json") {
      const value = parseJSON(file.data);
      console.warn("CHANNEL", metadata);
      metadata.set(`channel/${value.id}`, value);
    } else if (file.path.slice(-1)[0] === "messages.csv") {
      return (await parseCSV(file.data)).map((row) =>
        entry(
          row,
          "message",
          DateTime.fromJSDate(new Date(row.Timestamp)),
          null
        )
      );
    } else if (file.path[1] === "activity") {
      return smartDecode(file.data)
        .trim()
        .split("\n")
        .map((line) => {
          const parsed = parseJSON(line);
          return entry(
            parsed,
            "activity",
            DateTime.fromISO(parsed.timestamp.slice(1, -1)),
            null
          );
        });
    }
    return [];
  }

  render: (
    TimelineEntry<CategoryKey>,
    $ReadOnlyMap<string, any>
  ) => [?React.Node, ?string] = (entry, metadata) => {
    let body, trailer;
    if (entry.category === "activity") {
      const channel =
        metadata.get(`channel/${entry.value.channel_id}`) ||
        metadata.get(`channel/${entry.value.channel}`);
      const server =
        metadata.get(`servers`)?.[entry.value.guild_id || entry.value.server];

      body = entry.value.event_type
        .replace(/_/g, " ")
        .replace(/\w\S*/g, (w) => " " + w[0].toUpperCase() + w.slice(1));
      trailer =
        entry.value.type ||
        entry.value.name ||
        (channel?.name && `#${channel?.name} ${server ? `(${server})` : ""}`) ||
        (server && `in ${server}`) ||
        (entry.value.ip && `from ${entry.value.ip}`);
    } else if (entry.category === "message") {
      const channel = metadata.get(`channel/${entry.file[2].slice(1)}`);

      body = entry.value.Contents.replaceAll(
        /<(@!?|@&|#)([0-9]+)>/g,
        (original, type, snowflake) => {
          if (type === "@" || type === "@!") {
            // The users list isn't part of the export
            return "`@unknown`";
          } else if (type === "@&") {
            // The roles list isn't part of the export
            return "`&unknown`";
          } else if (type === "#") {
            const channel = metadata.get(`channel/${snowflake}`);
            return `\`#${channel?.name || "unknown"}\``;
          }
          return original;
        }
      );
      body = (
        <ReactMarkdown remarkPlugins={[remarkGfm]} linkTarget="_blank">
          {body}
        </ReactMarkdown>
      );
      if (entry.value.Attachments)
        body = (
          <React.Fragment>
            {body}
            <Pill>Attachment</Pill>
          </React.Fragment>
        );

      if (channel && [1, 3].includes(channel.type))
        trailer = "in direct message";
      else if (channel && [0, 2].includes(channel.type))
        trailer = `in #${channel.name} (${channel.guild.name})`;
      else if (channel && [10, 11, 12].includes(channel.type))
        trailer = `in thread "${channel.name}" (${channel.guild.name})`;
      else trailer = "in unknown channel";
    } else {
      throw new Error("Unknown category: " + entry.category);
    }
    return [body, trailer];
  };
}

export default Discord;
