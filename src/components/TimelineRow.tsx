import { DateTime } from "luxon";
import React from "react";

import { ProviderScopedDatabase } from "@src/common/database";
import type { TimelineEntry, TimelineEntryKey } from "@src/common/database";
import type { Provider } from "@src/common/provider";
import Record from "@src/components/Record";

import styles from "@src/components/TimelineRow.module.css";

export type Entry<T> = TimelineEntryKey<T> & {
  isGroup: false;
  time?: string;
};

export type Group = {
  isGroup: true;
  day: string;
  first?: boolean;
};

type Props<T> = {
  db: ProviderScopedDatabase<T>;
  isLast: boolean;
  metadata: ReadonlyMap<string, any>;
  provider: Provider<T>;
  row: Entry<T> | Group;
  selected?: string;
  setSelected: (selected: string) => any;
};

function TimelineRow<T>(props: Props<T>): JSX.Element {
  const { db, isLast, metadata, provider, row, selected, setSelected } = props;

  const [hydrated, setHydrated] = React.useState<TimelineEntry<T> | void>();
  React.useEffect(() => {
    (async () => {
      if (row.isGroup) return;
      const { isGroup, time, ...key } = row;
      setHydrated(await db.hydrateTimelineEntry(key));
    })();
  }, [db, row]);

  if (row.isGroup) {
    return (
      <React.Fragment>
        {!row.first && <hr className={styles.divider} />}
        <div className={styles.group} role="row">
          {DateTime.fromISO(row.day).toLocaleString(DateTime.DATE_HUGE)}
        </div>
      </React.Fragment>
    );
  } else {
    return (
      <div
        aria-selected={row && selected === row.slug}
        className={[
          styles.item,
          isLast && styles.last,
          // Don't apply hover states while loading, since the pane is all-black
          // anyways.
          hydrated && styles.loaded,
        ]
          .filter((x) => x)
          .join(" ")}
        role="row"
        onClick={() => row && setSelected(row.slug)}
      >
        <div className={styles.content}>
          {hydrated ? (
            (() => {
              const [body, trailer, username] =
                provider.render?.(hydrated, metadata) ||
                (hydrated.context as any);
              return (
                <Record
                  time={row.time}
                  username={username}
                  icon={provider.timelineCategories.get(row.category)?.icon}
                  body={body}
                  trailer={trailer}
                />
              );
            })()
          ) : (
            <React.Fragment>&nbsp;</React.Fragment>
          )}
        </div>
      </div>
    );
  }
}

export default TimelineRow;
