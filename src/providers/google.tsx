/* eslint-disable @typescript-eslint/no-explicit-any */
import { DateTime } from "luxon";
import { Minimatch } from "minimatch";
import React from "react";

import type { TimelineEntry } from "@src/common/database";
import { parseJSON } from "@src/common/parse";
import type {
  IgnoreParser,
  MetadataParser,
  TimelineParser,
} from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

type CategoryKey = "activity" | "chat" | "security";

class Google implements Provider<CategoryKey> {
  slug = "google";
  displayName = "Google";

  brandColor = "#34a853";
  neonColor = "#00c300";
  neonColorHDR = "color(rec2020 0.1856 0.71527 0.06415)";

  requestLink = {
    text: "Google Takeout",
    href: "https://takeout.google.com/",
  };
  waitTime = "1-2 days";
  instructions: ReadonlyArray<string> = [
    `check Access Log Activity`,
    ``,
    `under My Activity`,
    ` click Multiple Formats`,
    `  change HTML to JSON`,
  ];
  singleFile = true;
  fileName = "takeout.zip";
  privacyPolicy = "https://policies.google.com/privacy?hl=en#california";

  ignoreParsers: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("**") }, // for now
  ];

  metadataParsers: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("Takeout/Hangouts/Hangouts.json"),
      tokenize: (data) =>
        parseJSON(data).conversations.flatMap(
          (c: any) => c.conversation.conversation
        ),
      parse: (item) => [`hangouts.${item.id.id}`, item],
    },
  ];

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "activity",
      {
        char: "a",
        icon: "🖱",
        displayName: "Activity",
        defaultEnabled: true,
      },
    ],
    [
      "chat",
      {
        char: "c",
        icon: "💬",
        displayName: "Chat",
        defaultEnabled: true,
      },
    ],
    [
      "security",
      {
        char: "s",
        icon: "🪪",
        displayName: "Security Logs",
        defaultEnabled: false,
      },
    ],
  ]);

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("Takeout/Access Log Activity/Activities - *.csv"),
      parse: (item) => [
        "security",
        DateTime.fromSQL(item["Activity Timestamp"]),
        [
          item["Product Name"] === "Other"
            ? "Activity"
            : `Accessed ${item["Product Name"]}`,
          `from ${item["IP Address"]}`,
        ],
      ],
    },
    {
      glob: new Minimatch("Takeout/Drive/**/*-info.json"),
      tokenize: (data) => [parseJSON(data)],
      parse: (item) =>
        item.last_modified_by_me
          ? [
              "activity",
              DateTime.fromISO(item.last_modified_by_me),
              [`Edited "${item.title}"`, "Google Drive"],
            ]
          : undefined,
    },
    {
      glob: new Minimatch("Takeout/My Activity/*/MyActivity.json"),
      parse: (item) => {
        let { title, header } = item;
        if (
          item.details?.some(
            (x: { name: string }) => x.name === "From Google Ads"
          )
        )
          header = "Google Ads";
        if (
          header === "Maps" &&
          item.titleUrl?.startsWith("https://www.google.com/maps/place/")
        )
          title = `Viewed ${title}`;
        return ["activity", DateTime.fromISO(item.time), [title, header]];
      },
    },
    {
      glob: new Minimatch("Takeout/Hangouts/Hangouts.json"),
      tokenize: (data) =>
        parseJSON(data).conversations.flatMap((c: any) => c.events),
      parse: (item) => {
        if (item.event_type !== "REGULAR_CHAT_MESSAGE") {
          throw new Error("Unknown item type: " + item.event_type);
        }
        return ["chat", DateTime.fromMillis(item.timestamp / 1000), null];
      },
    },
  ];

  render = (
    entry: TimelineEntry<CategoryKey>,
    metadata: ReadonlyMap<string, unknown>
  ):
    | void
    | [JSX.Element, string | void]
    | [
        JSX.Element | void,
        string | void,
        { display: string; color?: string } | void
      ] => {
    if (entry.context !== null) return;

    const conversation = metadata.get(
      `hangouts.${entry.value.conversation_id.id}`
    ) as any;

    const self = entry.value.self_event_state.user_id.chat_id;

    const sender = conversation.participant_data.find(
      (p: any) => p.id.chat_id === entry.value.sender_id.chat_id
    );
    const displayName = (participant: any) =>
      participant.fallback_name?.endsWith("@gmail.com")
        ? participant.fallback_name.slice(0, -10)
        : participant.fallback_name || "unknown";

    const participants = conversation.participant_data.filter(
      (p: any) => p.id.chat_id !== self && p.id.chat_id !== sender.id.chat_id
    );
    const footer = conversation.name
      ? ` in ${conversation.name}`
      : sender.id.chat_id === self
      ? ` to ${displayName(participants[0])}`
      : participants.length <= 1
      ? undefined
      : ` with ${participants.map((p: any) => displayName(p)).join(", ")}`;

    const segments = entry.value.chat_message?.message_content?.segment || [];

    return [
      <React.Fragment>
        {segments.length
          ? segments.map((s: any) => {
              switch (s.type) {
                case "TEXT":
                  return s.text;
                case "LINK":
                  return (
                    <a
                      href={s.link_data?.link_target}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.link_data?.display_url || s.text}
                    </a>
                  );
                case "LINE_BREAK":
                  return <br />;
                default:
                  return `[${s.type || "UNKNOWN"}]`;
              }
            })
          : "[UNKNOWN]"}
      </React.Fragment>,
      footer,
      {
        display: displayName(sender),
        color: sender.id.chat_id === self ? this.neonColor : "#ccc",
      },
    ];
  };
}

export default Google;
