// @flow
import { deleteDB, openDB } from "idb";
import * as React from "react";
import { unzip } from "unzipit";

import styles from "providers/facebook.module.css";

import type { ActivityEvent, Provider, View } from "provider";

class Facebook implements Provider {
  slug: string = "facebook";
  displayName: string = "Facebook";

  async import(file: File): Promise<void> {
    const zip = await unzip(file);
    const entries: $ReadOnlyArray<any> = Object.values(zip.entries).filter(
      (entry) => !(entry: any).isDirectory
    );

    const metadata = new Map<string, { [string]: any }>();
    const noData = [];
    const content = new Map<string, { [string]: any }>();
    const media = new Map<string, Blob>();
    const tables = new Map<string, { [string]: any }>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.name.endsWith("/no-data.txt")) {
        const name = entry.name.slice(0, -12);
        noData.push(name);
      } else if (entry.name.startsWith("posts/media/")) {
        media.set(entry.name, await entry.blob());
      } else if (entry.name.startsWith("messages/stickers_used/")) {
        media.set(entry.name, await entry.blob());
      } else if (
        entry.name.startsWith("messages/") &&
        (entry.name.includes("/gifs/") ||
          entry.name.includes("/photos/") ||
          entry.name.includes("/videos/") ||
          entry.name.includes("/files/"))
      ) {
        media.set(entry.name, await entry.blob());
      } else if (
        entry.name.startsWith("messages/") &&
        entry.name.split("/").length > 2
      ) {
        // TODO: better mojibake handling
        let text = await entry.text();
        text = text.replaceAll("\\u00e2\\u0080\\u0099", "'");
        content.set(entry.name, JSON.parse(text));
      } else if (entry.name.startsWith("posts/")) {
        let text = await entry.text();
        text = text.replaceAll("\\u00e2\\u0080\\u0099", "'");
        content.set(entry.name, JSON.parse(text));
      } else if (entry.name.endsWith(".json")) {
        let text = await entry.text();
        text = text.replaceAll("\\u00e2\\u0080\\u0099", "'");
        const data = JSON.parse(text);
        if (Object.keys(data).length !== 1) {
          console.error("JSON:UNKNOWN", entry.name, data);
        } else {
          const key = Object.keys(data)[0];
          if (Object.keys(tables).includes(key)) {
            console.error("JSON:DUPLICATE_KEY", entry.name, data);
          }
          if (Array.isArray(data[key])) {
            if (data[key].length > 0 && typeof data[key][0] === "string") {
              metadata.set(key, data[key]);
            } else {
              tables.set(key, data[key]);
            }
          } else {
            metadata.set(key, data[key]);
          }
        }
      } else {
        console.error("UNKNOWN", entry.name);
      }
    }

    await deleteDB(this.slug);
    const db = await openDB(this.slug, 1, {
      async upgrade(db) {
        db.createObjectStore("_metadata");
        db.createObjectStore("_content");
        db.createObjectStore("_media");
        for (const [table] of tables) {
          db.createObjectStore(table, {
            autoIncrement: true,
          });
        }
      },
    });

    for (const [key, value] of metadata) {
      await db.put("_metadata", value, key);
    }
    await db.put("_metadata", noData, "no_data");

    for (const [key, value] of content) {
      await db.put("_content", value, key);
    }

    for (const [key, value] of media) {
      await db.put("_media", value, key);
    }

    for (const [key, values] of tables) {
      const tx = db.transaction(key, "readwrite");
      await Promise.all(values.map((value) => tx.store.put(value)));
      await tx.done;
    }
  }

  views(db: any): $ReadOnlyArray<View<any>> {
    if (!db) return [];
    return [...db.objectStoreNames].map((slug) => new GenericView(slug));
  }

  async activityEvents(db: any): Promise<Array<ActivityEvent<any>>> {
    const rows = [];
    for (const view of this.views(db)) {
      const keys = await db.getAllKeys(view.slug);
      const values = await db.getAll(view.slug);
      const metadata = await view.metadata(db);
      for (let i = 0; i < (await values).length; i++) {
        const key = keys[i];
        const data = values[i];
        if (view.slug === "_content") {
          if (key.startsWith("messages/")) {
            for (const message of data.messages) {
              const timestamp = message.timestamp_ms;
              let label = message.sender_name;
              if (data.thread_type === "RegularGroup") {
                label += ` in ${data.title}`;
              }
              label += `: ${message.content}`;
              rows.push({ timestamp, label, data, view, metadata });
            }
          } else {
            console.warn("Skipping", key);
          }
        } else if (
          view.slug === "comments_v2" ||
          view.slug === "group_comments_v2" ||
          view.slug === "group_posts_v2" ||
          view.slug === "groups_joined_v2" ||
          view.slug === "pages_unfollowed_v2" ||
          view.slug === "poll_votes_v2" ||
          view.slug === "reactions_v2"
        ) {
          rows.push({
            timestamp: data.timestamp,
            label: data.title,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "contact_verifications_v2") {
          rows.push({
            timestamp: data.verification_time,
            label: `Security Event: verified contact ${data.contact}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "deleted_friends_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Un-friended ${data.name}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "events_invited_v2") {
          rows.push({
            timestamp: data.start_timestamp,
            label: `Event ${data.name} started (you were invited)`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "friends_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Became friends with ${data.name}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "groups_admined_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Became a group admin in ${data.name}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "installed_apps_v2") {
          if (data.added_timestamp) {
            rows.push({
              timestamp: data.added_timestamp,
              label: `Installed app ${data.name}`,
              data,
              view,
              metadata,
            });
          }
          if (data.removed_timestamp) {
            rows.push({
              timestamp: data.removed_timestamp,
              label: `Removed app ${data.name}`,
              data,
              view,
              metadata,
            });
          }
        } else if (view.slug === "language_and_locale_v2") {
          if (data.name === "Language Settings") {
            const locales = data.children.find(
              (c) => c.name === "Locale Changes"
            );
            if (locales) {
              for (const entry of locales.entries) {
                rows.push({
                  timestamp: entry.timestamp,
                  label: `Changed locale settings`,
                  data,
                  view,
                  metadata,
                });
              }
            }
          } else {
            console.warn("Skipping", data.name);
          }
        } else if (view.slug === "notifications_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Notification: ${data.text}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "off_facebook_activity_v2") {
          for (const event of data.events) {
            rows.push({
              timestamp: event.timestamp,
              label: `${event.type} EVENT at ${data.name}`,
              data,
              view,
              metadata,
            });
          }
        } else if (view.slug === "people_and_friends_v2") {
          if (data.name === "See Less") {
            for (const entry of data.entries) {
              rows.push({
                timestamp: entry.timestamp,
                label: `Chose to see less of ${entry.data.name}`,
                data,
                view,
                metadata,
              });
            }
          } else {
            console.warn("Skipping People and Friends item", data);
          }
        } else if (view.slug === "received_requests_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Received friend request from ${data.name}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "recently_viewed") {
          if (data.name === "Fundraisers" || data.name === "Ads") {
            for (const entry of data.entries) {
              rows.push({
                timestamp: entry.timestamp,
                label: `Viewed ${data.name}: ${entry.data.name}`,
                data,
                view,
                metadata,
              });
            }
          } else {
            console.warn("Skipping Recently Viewed item", data);
          }
        } else if (view.slug === "rejected_requests_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Rejected friend request from ${data.name}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "searches_v2") {
          rows.push({
            timestamp: data.timestamp,
            label: `Searched: ${data.data.text}`,
            data,
            view,
            metadata,
          });
        } else if (view.slug === "visited_things_v2") {
          if (data.name === "Profile visits") {
            for (const entry of data.entries) {
              rows.push({
                timestamp: entry.timestamp,
                label: `Viewed profile: ${entry.data.name}`,
                data,
                view,
                metadata,
              });
            }
          } else if (data.name === "Events visited") {
            for (const entry of data.entries) {
              rows.push({
                timestamp: entry.timestamp,
                label: `Viewed event: ${entry.data.name}`,
                data,
                view,
                metadata,
              });
            }
          } else if (data.name === "Groups visited") {
            for (const entry of data.entries) {
              rows.push({
                timestamp: entry.timestamp,
                label: `Viewed group: ${entry.data.name}`,
                data,
                view,
                metadata,
              });
            }
          } else {
            console.warn("Skipping visited thing", data.name);
          }
        } else {
          console.warn("Skpping", view.slug);
        }
      }
    }
    return rows;
  }
}

class GenericView implements View<void> {
  slug: string;
  displayName: string;

  constructor(slug: string) {
    this.slug = slug;
    this.displayName = slug;
  }

  async metadata(db: any): Promise<void> {}

  render(key: string, item: { [string]: any }, metadata: void): React.Node {
    let content;
    if (typeof key === "string") {
      content = key;
    } else if (typeof item.name === "string" && item.name !== "") {
      content = item.name;
    } else {
      content = JSON.stringify(item);
    }
    return <span className={styles.item}>{content}</span>;
  }
}

export default Facebook;
