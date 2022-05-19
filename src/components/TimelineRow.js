// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { ProviderScopedDatabase } from "common/database";
import Record from "components/Record";

import styles from "components/TimelineRow.module.css";

import type { TimelineEntryKey } from "common/database";
import type { Provider } from "common/provider";

export type Entry = $ReadOnly<{|
  isGroup: false,
  ...TimelineEntryKey,
  time: ?string,
|}>;

export type Group = {|
  isGroup: true,
  +day: string,
  +first?: boolean,
|};

type Props = {|
  +db: ProviderScopedDatabase,
  +isLast: boolean,
  +metadata: $ReadOnlyMap<string, any>,
  +provider: Provider<any>,
  +row: Entry | Group,
  +selected: ?string,
  +setSelected: (string) => any,
|};

function TimelineRow(props: Props): React.Node {
  const { db, isLast, metadata, provider, row, selected, setSelected } = props;

  const [hydrated, setHydrated] = React.useState();
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
        className={[styles.item, isLast && styles.last]
          .filter((x) => x)
          .join(" ")}
        role="row"
        onClick={() => row && setSelected(row.slug)}
      >
        <div className={styles.content}>
          {hydrated ? (
            (() => {
              // $FlowFixMe[invalid-tuple-index]
              // $FlowFixMe[incompatible-use]
              const [body, trailer, username] =
                provider.render?.(hydrated, metadata) || hydrated.context;
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
