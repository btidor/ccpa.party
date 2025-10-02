import React from "react";

import type { RenderResult } from "@src/common/renderer";
import { Highlight, Pill } from "@src/components/Record";
import type { TimelineEntry } from "@src/database/types";
import type { CategoryKey } from "@src/providers/slack";

import emoji from "@src/common/emoji.json";

export default function render(
  entry: TimelineEntry<CategoryKey>,
  metadata: ReadonlyMap<string, unknown>,
): RenderResult {
  type User = {
    profile: { display_name?: string; real_name?: string };
    color: string;
  } | void;
  type Channel = { name: string } | void;
  type Element = {
    type: string;
    text?: string;
    elements?: Element[];
    style?: {
      bold: boolean;
      italic: boolean;
      strike: boolean;
      code: boolean;
    };
    name?: string;
    user_id?: string;
    channel_id?: string;
    url?: string;
  };
  type Message = {
    text?: string;
    [key: string]: unknown;
  };

  const message = entry.value as Message;
  const channelName =
    entry.category === "message"
      ? entry.file[1]
      : (metadata.get(`channel.${message.channel}`) as Channel)?.name;
  let trailer = channelName && `#${channelName}`;

  const user = metadata.get(`user.${message.user || message.user_id}`) as User;
  const username = {
    display: (user
      ? user.profile.display_name || user.profile.real_name
      : message.user_name || message.bot_id || "unknown") as string,
    color: user?.color && `#${user.color}`,
  };
  let text = message.text ? <span>{message.text}</span> : undefined;
  if (message.files || message.attachments) {
    text = (
      <React.Fragment>
        {text}
        <Pill>Attachment</Pill>
      </React.Fragment>
    );
  }
  if (message.subtype === "channel_join") {
    text = undefined;
    trailer = `joined #${channelName}`;
  }
  if (entry.category === "integration") {
    let verb = message.change_type;
    if (verb === "wildcard_resource_grant_created") verb = "created";
    trailer = `${verb} integration ${message.app_type || message.service_type}`;
    if (channelName) trailer += ` in #${channelName}`;
  }
  let key = 0;
  const handleElement = (element: Element): JSX.Element | JSX.Element[] => {
    key++;
    if (element.type === "rich_text_section") {
      return (element.elements || []).flatMap(handleElement);
    } else if (element.type === "rich_text_list") {
      return (
        <ul key={key}>
          {(element.elements || []).map((subelement) => (
            <li key={key++}>{handleElement(subelement)}</li>
          ))}
        </ul>
      );
    } else if (element.type === "rich_text_quote") {
      return (
        <blockquote key={key}>
          {(element.elements || []).flatMap(handleElement)}
        </blockquote>
      );
    } else if (element.type === "rich_text_preformatted") {
      return (
        <pre key={key}>{(element.elements || []).flatMap(handleElement)}</pre>
      );
    } else if (element.type === "text") {
      let node = <span>{element.text}</span>;
      if (element.style) {
        if (element.style.bold) node = <b>{node}</b>;
        if (element.style.italic) node = <i>{node}</i>;
        if (element.style.strike) node = <s>{node}</s>;
        if (element.style.code) node = <code>{node}</code>;
      }
      return [<span key={key}>{node}</span>];
    } else if (element.type === "emoji") {
      const unicode = element.name && emoji[element.name as keyof typeof emoji];
      return [
        <span key={key}>
          {typeof unicode === "string" ? unicode : `:${element.name}`}
        </span>,
      ];
    } else if (element.type === "user") {
      const user = metadata.get(`user.${element.user_id}`) as User;
      return [
        <Highlight key={key}>
          @{user?.profile.display_name || user?.profile.real_name || "unknown"}
        </Highlight>,
      ];
    } else if (element.type === "channel") {
      const channel = metadata.get(`channel.${element.channel_id}`) as Channel;
      return [<Highlight key={key}>#{channel?.name || "unknown"}</Highlight>];
    } else if (element.type === "link") {
      return [
        <a href={element.url} key={key} target="_blank" rel="noreferrer">
          {element.text || element.url}
        </a>,
      ];
    } else {
      return [<Pill key={key}>{element.type}</Pill>];
    }
  };
  if (message.blocks) {
    text = (
      <React.Fragment>
        {(message.blocks as Element[]).flatMap((block) => {
          key++;
          if (block.type !== "rich_text") {
            return <Pill key={key}>{block.type}</Pill>;
          } else {
            return (block.elements || []).flatMap(handleElement);
          }
        })}
      </React.Fragment>
    );
  }

  return [text, trailer, username];
}
