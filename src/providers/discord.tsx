import { DateTime } from "luxon";
import { Minimatch } from "minimatch";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { TimelineEntry } from "@src/common/database";
import { parseJSON, parseJSONND } from "@src/common/parse";
import type { MetadataParser, TimelineParser } from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";
import { Pill } from "@src/components/Record";

type CategoryKey = "activity" | "message";

class Discord implements Provider<CategoryKey> {
  slug: string = "discord";
  displayName: string = "Discord";

  brandColor: string = "#5865f2";
  neonColor: string = "#4087ff";
  neonColorHDR: string = "color(rec2020 0.4889 0.52224 1.46496)";

  requestLink: { href: string; text: string } = {
    text: "Discord",
    href: "https://discord.com/app",
  };
  waitTime: string = "about a week";
  instructions: ReadonlyArray<string> = [
    "open User Settings",
    "Privacy & Safety tab",
    "scroll down",
  ];
  singleFile: boolean = true;
  fileName: string = "package.zip";
  privacyPolicy: string =
    "https://discord.com/privacy#information-for-california-users";

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
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

  metadataParsers: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("servers/index.json"),
      tokenize: (data) => Object.entries(parseJSON(data)),
      parse: ([k, v]) => [`server.${k}`, v],
    },
    {
      glob: new Minimatch("messages/index.json"),
      tokenize: (data) => Object.entries(parseJSON(data)),
      parse: ([k, v]) => [`channel.${k}`, v],
    },
    {
      glob: new Minimatch("messages/*/channel.json"),
      tokenize: (data) => [parseJSON(data)],
      parse: (item) => [`channel_meta.${item.id}`, item],
    },
  ];

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("messages/*/messages.csv"),
      parse: (item) => [
        "message",
        DateTime.fromJSDate(new Date(item.Timestamp)),
        null,
      ],
    },
    {
      glob: new Minimatch("activity/*/events-*.json"),
      tokenize: parseJSONND,
      parse: (item) => [
        "activity",
        DateTime.fromISO(item.timestamp.slice(1, -1)),
        null,
      ],
    },
  ];

  render = (
    entry: TimelineEntry<CategoryKey>,
    metadata: ReadonlyMap<string, any>
  ): [JSX.Element, string | void] => {
    let body, trailer;
    if (entry.category === "activity") {
      const channel = metadata.get(
        `channel_meta.${entry.value.channel_id || entry.value.channel}`
      );
      const server = metadata.get(
        `server.${entry.value.guild_id || entry.value.server}`
      );

      body = (entry.value.event_type as string)
        .replace(/_/g, " ")
        .replace(/\w\S*/g, (w) => " " + w[0].toUpperCase() + w.slice(1));
      trailer =
        entry.value.type ||
        entry.value.name ||
        (channel?.name && `#${channel?.name} ${server ? `(${server})` : ""}`) ||
        (server && `in ${server}`) ||
        (entry.value.ip && `from ${entry.value.ip}`);
    } else if (entry.category === "message") {
      body = (entry.value.Contents as string).replaceAll(
        /<(@!?|@&|#)([0-9]+)>/g,
        (original, type, snowflake) => {
          if (type === "@" || type === "@!") {
            // The users list isn't part of the export
            return "`@unknown`";
          } else if (type === "@&") {
            // The roles list isn't part of the export
            return "`&unknown`";
          } else if (type === "#") {
            const channel = metadata.get(`channel.${snowflake}`);
            return `\`${
              channel === undefined
                ? "#unknown"
                : channel.includes(" ")
                ? channel
                : `#${channel}`
            }\``;
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

      const channel = metadata.get(`channel_meta.${entry.file[2].slice(1)}`);
      const fallback = metadata.get(`channel.${entry.file[2].slice(1)}`);
      if (channel && [0, 2].includes(channel.type))
        trailer = `in #${channel.name} (${channel.guild.name})`;
      else if (channel && [10, 11, 12].includes(channel.type))
        trailer = `in thread "${channel.name}" (${channel.guild.name})`;
      else if (fallback) trailer = `in ${fallback.toLowerCase()}`;
      else trailer = "in unknown channel";
    } else {
      throw new Error("Unknown category: " + entry.category);
    }
    return [body as JSX.Element, trailer];
  };
}

export default Discord;
