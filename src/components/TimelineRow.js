// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { ProviderScopedDatabase } from "common/database";

import styles from "components/TimelineRow.module.css";

import type { TimelineEntryKey } from "common/database";
import type { Provider } from "common/provider";

import SimpleRecord from "components/SimpleRecord"; // TODO

export type Entry = $ReadOnly<{| ...TimelineEntryKey, time: ?string |}>;

export type Group = {|
  +type: "group",
  +value: string,
  +first?: boolean,
|};

type Props = {|
  +db: ProviderScopedDatabase,
  +isLast: boolean,
  +provider: Provider,
  +row: Entry | Group,
  +selected: ?string,
  +setSelected: (string) => any,
|};

function TimelineRow(props: Props): React.Node {
  const { db, isLast, row, selected, setSelected } = props;

  const [hydrated, setHydrated] = React.useState();
  React.useEffect(() => {
    (async () => {
      if (row.type === "group") return;
      const { time, ...key } = row;
      setHydrated(await db.hydrateTimelineEntry(key));
    })();
  }, [db, row]);

  if (row.type === "group") {
    return (
      <React.Fragment>
        {!row.first && <hr className={styles.divider} />}
        <div className={styles.group} role="row">
          {DateTime.fromISO(row.value).toLocaleString(DateTime.DATE_HUGE)}
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
              const [body, trailer, username] = hydrated.context;
              return (
                <SimpleRecord
                  time={row.time}
                  username={username}
                  icon={
                    this.timelineCategories.find((c) => c.slug === row.category)
                      ?.icon
                  }
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
