/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

import type { TimelineEntry } from "@src/common/database";
import type { RenderResult } from "@src/common/renderer";
import type { CategoryKey } from "@src/providers/google";
import Google from "@src/providers/google";

const provider = new Google();

export default function render(
  entry: TimelineEntry<CategoryKey>,
  metadata: ReadonlyMap<string, unknown>
): RenderResult {
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
      color: sender.id.chat_id === self ? provider.neonColor : "#ccc",
    },
  ];
}
