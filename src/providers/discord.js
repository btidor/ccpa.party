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
import SimpleRecord, { Pill } from "components/SimpleRecord";

import type { DataFile, TimelineContext, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Discord implements Provider {
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

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      icon: "🖱",
      displayName: "Activity",
      defaultEnabled: false,
    },
    {
      char: "m",
      slug: "message",
      icon: "💬",
      displayName: "Sent Messages",
      defaultEnabled: true,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<TimelineEntry>> {
    const entry = (
      row: any,
      category: string,
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
      return [
        {
          type: "metadata",
          provider: file.provider,
          key: "servers",
          value: parseJSON(file.data),
        },
      ];
    } else if (file.path.slice(-1)[0] === "channel.json") {
      const value = parseJSON(file.data);
      return [
        {
          type: "metadata",
          provider: file.provider,
          key: `channel/${value.id}`,
          value,
        },
      ];
    } else if (file.path.slice(-1)[0] === "messages.csv") {
      return (await parseCSV(file.data)).map((row) =>
        entry(
          row,
          "message",
          DateTime.fromJSDate(new Date(row.Timestamp)),
          file.path[2].slice(1)
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

  render(
    entry: TimelineEntry,
    time: ?string,
    metadata: $ReadOnlyMap<string, any>
  ): React.Node {
    let icon, body, trailer;
    if (entry.category === "activity") {
      const channel =
        metadata.get(`channel/${entry.value.channel_id}`) ||
        metadata.get(`channel/${entry.value.channel}`);
      const server =
        metadata.get(`servers`)?.[entry.value.guild_id || entry.value.server];

      icon = "🖱";
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
      const channel = metadata.get(`channel/${entry.context}`);

      icon = "💬";
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

    return (
      <SimpleRecord time={time} icon={icon} body={body} trailer={trailer} />
    );
  }
}

export default Discord;
