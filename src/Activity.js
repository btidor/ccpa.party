// @flow
import { openDB } from "idb";
import * as React from "react";
import { useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProvider } from "provider";

import styles from "Explore.module.css";

import type { Provider, View } from "provider";

type Row<M> = {|
  timestamp: number,
  label: any,
  data: any,

  view: View<M>,
  metadata: M,
|};

type Cache = {|
  db: any,
  provider: Provider,
  rows: Array<Row<any>>,
|};

let cache: ?Cache;

function Activity(): React.Node {
  const params = useParams();

  const [, setRefreshKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      const provider = getProvider(params.provider);
      const db = await openDB(provider.slug);
      const views = provider.views(db);

      const rows = [];
      for (const view of views) {
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
          } else if (view.slug === "account_activity_v2") {
            rows.push({
              timestamp: data.timestamp,
              label: `Security Event: ${data.action} from ${data.ip_address}`,
              data,
              view,
              metadata,
            });
          } else if (view.slug === "admin_records_v2") {
            rows.push({
              timestamp: data.session.timestamp,
              label: `Security Event: ${data.event}`,
              data,
              view,
              metadata,
            });
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
      for (const row of rows) {
        if (row.timestamp > 9999999999) row.timestamp /= 1000;
      }
      rows.sort((a, b) => b.timestamp - a.timestamp);
      cache = {
        db,
        provider,
        rows,
      };
      setRefreshKey(1);
    })();
  }, [params]);

  if (!cache) {
    return <main>📊 Loading...</main>;
  } else {
    return (
      <React.Fragment>
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={cache.rows.length}
              itemContent={(index) => {
                const row = cache && cache.rows[index];
                if (row) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {row.view.render(row.label, row.data, row.metadata)}
                    </div>
                  );
                } else {
                  return <div>Loading... #{index}</div>;
                }
              }}
            />
          </div>
          <div className={styles.drilldown}>
            {(() => {
              if (!cache || typeof drilldownItem !== "number") {
                return;
              }
              const row = cache.rows[drilldownItem];
              if (row.data instanceof Blob) {
                const filename = row.label;
                const url = URL.createObjectURL(row.data);
                return (
                  <React.Fragment>
                    <img
                      src={url}
                      alt="uploaded content"
                      className={styles.media}
                    />
                    <a href={url} download={filename}>
                      Download
                    </a>
                  </React.Fragment>
                );
              } else if (typeof row.data === "string") {
                let content = row.value;
                try {
                  content = JSON.stringify(JSON.parse(row.data), undefined, 2);
                } catch {}
                return <pre>{content}</pre>;
              } else {
                return <pre>{JSON.stringify(row.data, undefined, 2)}</pre>;
              }
            })()}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Activity;
