// @flow
import EmojiMap from "emoji-name-map";
import { openDB } from "idb";
import * as React from "react";
import { unzip } from "unzipit";

import type { Provider } from "provider";

type SlackMetadata = {|
  channels: { [key: string]: { [key: string]: any } },
  users: { [key: string]: { [key: string]: any } },
|};

class Slack implements Provider<SlackMetadata> {
  slug: string = "slack";
  displayName: string = "Slack";

  async import(file: File): Promise<void> {
    const zip = await unzip(file);
    const db = await openDB("data", 1, {
      async upgrade(db) {
        const channels = await db.createObjectStore("slack.channels", {
          keyPath: "id",
        });
        channels.createIndex("name", "name", { unique: true });

        db.createObjectStore("slack.integration_logs", {
          keyPath: "_id",
          autoIncrement: true,
        });
        db.createObjectStore("slack.messages", { keyPath: ["channel", "ts"] });
        db.createObjectStore("slack.users", { keyPath: "id" });
      },
    });

    const channels = await zip.entries["channels.json"].json();
    const tx1 = db.transaction("slack.channels", "readwrite");
    for (const channel of channels) {
      await tx1.store.put(channel);
    }
    await tx1.done;

    const integrationLogs = await zip.entries["integration_logs.json"].json();
    const tx2 = db.transaction("slack.integration_logs", "readwrite");
    for (const log of integrationLogs) {
      await tx2.store.put(log);
    }
    await tx2.done;

    const users = await zip.entries["users.json"].json();
    const tx3 = db.transaction("slack.users", "readwrite");
    for (const user of users) {
      await tx3.store.put(user);
    }
    await tx3.done;

    const files = Object.entries(zip.entries).filter(([name, entry]) => {
      if (
        ["channels.json", "integration_logs.json", "users.json"].includes(name)
      )
        return false;
      if (!entry) return false;
      if (entry.isDirectory) return false;
      return true;
    });
    for (let i = 0; i < files.length; i += 25) {
      const data = await Promise.all(
        files.slice(i, i + 25).map(async ([name, entry]) => {
          let aentry: any = entry;
          return [
            await db.getFromIndex("slack.channels", "name", name.split("/")[0]),
            await aentry.json(),
          ];
        })
      );
      const tx = db.transaction("slack.messages", "readwrite");
      for (const [channel, messages] of data) {
        for (const message of messages) {
          message.channel = channel.id;
          await tx.store.put(message);
        }
      }
      await tx.done;
    }
  }

  async categories(db: any): Promise<$ReadOnlyArray<string>> {
    return ["Users", "Channels", "Integration Logs", "All Messages"];
  }

  async metadata(db: any): Promise<SlackMetadata> {
    const users = {};
    (await db.getAll("slack.users")).forEach((u) => (users[u.id] = u));
    const channels = {};
    (await db.getAll("slack.channels")).forEach((ch) => (channels[ch.id] = ch));
    return { channels, users };
  }

  render(item: { [key: string]: any }, metadata: SlackMetadata): React.Node {
    let name;
    let style = {};
    const user = metadata.users[item.user];
    if (!!user) {
      name = user.profile.display_name || user.profile.real_name;
      if (user.color) style = { color: `#${user.color}` };
    } else {
      name = "<unknown_user>";
    }
    let ch;
    const channel = metadata.channels[item.channel];
    if (!!channel) {
      ch = channel.name;
    } else {
      ch = "<unknown_channel>";
    }
    let message = item.text;
    let messageClass = "message";
    if (item.files || item.attachments) {
      message += " <attachment>";
    }
    if (item.subtype === "channel_join") {
      message = `joined #${ch}`;
      messageClass = "system-message";
    }
    let key = 0;
    const handleElement = (element) => {
      key++;
      if (element.type === "rich_text_section") {
        return element.elements.flatMap(handleElement);
      } else if (element.type === "rich_text_list") {
        return (
          <ul key={key}>
            {element.elements.map((subelement) => (
              <li key={key++}>{handleElement(subelement)}</li>
            ))}
          </ul>
        );
      } else if (element.type === "rich_text_quote") {
        return (
          <blockquote key={key}>
            {element.elements.flatMap(handleElement)}
          </blockquote>
        );
      } else if (element.type === "rich_text_preformatted") {
        return <pre key={key}>{element.elements.flatMap(handleElement)}</pre>;
      } else if (element.type === "text") {
        // TODO: handle "style" attributes
        return [<React.Fragment key={key}>{element.text}</React.Fragment>];
      } else if (element.type === "emoji") {
        return [
          <React.Fragment key={key}>
            {EmojiMap.get(element.name) || `:${element.name}:`}
          </React.Fragment>,
        ];
      } else if (element.type === "user") {
        return [
          <React.Fragment key={key}>
            @
            {metadata.users[element.user_id].display_name ||
              metadata.users[element.user_id].real_name}
          </React.Fragment>,
        ];
      } else if (element.type === "channel") {
        return [
          <React.Fragment key={key}>
            #{metadata.channels[element.channel_id].name}
          </React.Fragment>,
        ];
      } else if (element.type === "link") {
        return [
          <a href={element.url} key={key}>
            {element.url}
          </a>,
        ];
      } else {
        return [
          <React.Fragment key={key}>
            &lt;unknown:{element.type}&gt;
          </React.Fragment>,
        ];
      }
    };
    if (item.blocks) {
      message = item.blocks.flatMap((block) => {
        key++;
        if (block.type !== "rich_text") {
          return (
            <React.Fragment key={key}>
              &lt;unknown:{block.type}&gt;
            </React.Fragment>
          );
        } else {
          return block.elements.flatMap(handleElement);
        }
      });
    }
    return (
      <React.Fragment>
        <span className="channel">#{ch}</span>{" "}
        <span style={style} className="username">
          {name}
        </span>{" "}
        <span className={messageClass}>{message}</span>
      </React.Fragment>
    );
  }
}

export default Slack;
