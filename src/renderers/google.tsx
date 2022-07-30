/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

import type { RenderResult } from "@src/common/renderer";
import type { TimelineEntry } from "@src/database/types";
import type { CategoryKey } from "@src/providers/google";
import Google from "@src/providers/google";

const provider = new Google();

type UserType = "Human" | "Bot";

type MembershipState =
  | "MEMBER_UNKNOWN"
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "MEMBER_NOT_A_MEMBER"
  | "MEMBER_FAILED";

type User = { name: string; email: string; user_type: UserType };

type UserInfo = {
  user: User;
  membership_info: [
    {
      group_name?: string;
      group_id: string;
      membership_state: MembershipState;
    }
  ];
};

type GroupInfo = {
  name: string; // defaults to "Group Chat"
  members: [User];
};

type Reaction = {
  emoji: { unicode: string };
  reactor_emails: ReadonlyArray<string>;
};

type Message = {
  creator: User;
  created_date: string;
  text: string;
  annotations: unknown;
  reactions: [Reaction];
  topic_id: string;
};

export default function render(
  entry: TimelineEntry<CategoryKey>,
  metadata: ReadonlyMap<string, unknown>
): RenderResult {
  if (entry.context !== null) return;

  const group_id = entry.file.at(-2);
  const message = entry.value as Message;
  const user = metadata.get("chat.user_info") as UserInfo;
  const group = metadata.get(`chat.${group_id}`) as GroupInfo;

  let footer: string | void;
  const group2 = user.membership_info.find(
    (info) => info.group_id === group_id
  );
  if (group2?.group_name) {
    footer = ` in ${group2.group_name}`;
  } else {
    const others = group.members.filter(
      (member) => member.email !== user.user.email
    );
    if (others.length === 0) {
      footer = undefined; // weird
    } else if (others.length === 1) {
      if (message.creator.email === user.user.email) {
        footer = ` to ${others[0].name}`;
      } else {
        footer = undefined;
      }
    } else {
      footer = ` with ${others.map((m) => m.name).join(", ")}`;
    }
  }

  return [
    <React.Fragment>
      {message.text}
      {message.reactions &&
        ` (${message.reactions.map((r) => r.emoji.unicode).join(" ")})`}
    </React.Fragment>,
    footer,
    {
      display: message.creator.name,
      color:
        message.creator.email === user.user.email ? provider.neonColor : "#ccc",
    },
  ];
}
