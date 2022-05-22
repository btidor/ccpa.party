import { DateTime } from "luxon";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { ProviderScopedDatabase } from "@/common/database";

import DatePicker from "@/components/DatePicker";
import FilePreview from "@/components/FilePreview";
import FilterBar from "@/components/FilterBar";
import Navigation from "@/components/Navigation";
import Placeholder from "@/components/Placeholder";
import TimelineRow from "@/components/TimelineRow";

import styles from "@/Drilldown.module.css";

import type { TimelineEntryKey, TimelineEntry } from "@/common/database";
import type { Provider } from "@/common/provider";
import type { Entry, Group } from "@/components/TimelineRow";

type Props<T> = {
  provider: Provider<T>;
  filter?: string;
  selected?: string;
};

function Timeline<T>(props: Props<T>): JSX.Element {
  const { provider, filter, selected } = props;
  const navigate = useNavigate();
  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new ProviderScopedDatabase(provider, () => setEpoch(epoch + 1)),
    [epoch, provider]
  );

  // Convert the abbreviated filter string (e.g. "acns") to a set of slugs (e.g.
  // {"activity", "content", ...}) for fast lookups.
  const selectedCategories = React.useMemo(
    () =>
      new Set(
        Array.from(filter || []).map(
          (ch) =>
            Array.from(provider.timelineCategories.entries()).find(
              ([slug, category]) => category.char === ch
            )?.[0]
        )
      ),
    [filter, provider]
  );

  // Load *all* timeline entries from the database (unhydrated: these are just
  // the keys), as well as the provider-specific metadata.
  const [entries, setEntries] = React.useState<TimelineEntryKey<T>[]>();
  const [metadata, setMetadata] = React.useState<ReadonlyMap<string, any>>();
  React.useEffect(() => {
    // When `provider` changes, immediately unset `entries` and `metadata`. This
    // prevents downstream components from performing their initialization with
    // incorrect data.
    setEntries(undefined);
    setMetadata(undefined);
    (async () => {
      const entries = await db.getTimelineEntries();
      entries.reverse(); // sort in descending order by timestamp/slug
      setEntries(entries);
      setMetadata(await db.getMetadata());
    })();
  }, [db, provider]);

  // If there are no timeline entries in the database, check if the user has
  // imported a file yet. If not, send them back to the import page. This check
  // needs to live in a separate `useEffect` because the `navigate` dependency
  // makes it re-run on every page navigation.
  React.useEffect(() => {
    (async () => {
      if (entries && entries.length === 0) {
        const files = await db.getFiles();
        if (files.length === 0) navigate(`/${provider.slug}`);
      }
    })();
  }, [db, entries, navigate, provider]);

  // Compute the rows to display by filtering down the entries to just the ones
  // in the selected categories and adding group headers for each day. We have
  // to recompute this every time the list of selected categories chanages.
  const rows = React.useMemo(() => {
    if (entries === undefined) {
      return undefined;
    } else {
      const filtered = entries.filter((entry) =>
        selectedCategories.has(entry.category)
      );
      const rows = [] as Array<Entry<T> | Group>;
      let lastGroup;
      let lastTime;
      for (const entry of filtered) {
        if (entry.day !== lastGroup) {
          rows.push({
            isGroup: true,
            day: entry.day,
            first: lastGroup === undefined,
          });
          lastGroup = entry.day;
          lastTime = undefined;
        }
        let time: string | undefined = DateTime.fromSeconds(
          entry.timestamp
        ).toLocaleString(DateTime.TIME_24_SIMPLE);
        lastTime === time ? (time = undefined) : (lastTime = time);
        rows.push({ ...entry, time, isGroup: false });
      }
      return rows;
    }
  }, [selectedCategories, entries]);

  // Hydrate the currently-selected entry from the database. We have to
  // recompute this every time the selected entry changes.
  const [selectedEntry, setSelectedEntry] = React.useState<TimelineEntry<T>>();
  React.useEffect(() => {
    // When the dependencies change, *don't* immediately unset `selectedEntry`.
    // This would cause the loading message to appear briefly; instead, we allow
    // the previous item to ghost in the drilldown pane for a few moments while
    // the next item is loaded.
    (async () => {
      if (filter === undefined) return;

      let drilldownItem;
      if (selected) {
        drilldownItem = await db.getTimelineEntryBySlug(selected);

        // Extra: if the currently-selected entry does not exist in the
        // database, or if it's of the wrong category, deselect it.
        if (!drilldownItem || !selectedCategories.has(drilldownItem.category)) {
          navigate(`/${provider.slug}/timeline:${filter}`, { replace: true });
        }
      }
      setSelectedEntry(drilldownItem || undefined);
    })();
  }, [db, filter, navigate, provider, selected, selectedCategories]);

  // On first load, if an entry is selected, scroll the list to its approximate
  // position.
  const virtuoso = React.useRef<any>();
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!loaded && virtuoso.current && rows) {
      const index =
        selected && rows.findIndex((e) => !e.isGroup && e.slug === selected);
      index && virtuoso.current.scrollToIndex(index - 3);
      setLoaded(true);
    }
  }, [rows, loaded, selected, virtuoso]);

  // As the user scrolls, update the date picker to reflect the date of the
  // first visible row.
  const [rangeStart, setRangeStart] = React.useState(0);

  return (
    <div
      className={styles.outer}
      style={
        {
          "--neon-hex": props.provider.neonColor,
          "--neon-hdr": props.provider.neonColorHDR,
        } as React.CSSProperties
      }
    >
      <Navigation provider={provider} pageSlug="timeline" />
      <main className={styles.drilldown}>
        <div
          className={styles.container}
          style={{ "--left-width": "60vw" } as React.CSSProperties}
        >
          <div className={styles.left}>
            <div className={styles.bar}>
              <FilterBar
                filter={filter}
                filterPath={(newFilter) =>
                  `/${provider.slug}/timeline:${newFilter}${
                    selected ? "@" + selected : ""
                  }`
                }
                provider={provider}
              />
              <div className={styles.grow}></div>
              <DatePicker
                index={rangeStart}
                rows={rows}
                scrollToIndex={virtuoso.current?.scrollToIndex}
              />
            </div>
            <div className={styles.box}>
              {!rows || rows.length === 0 ? (
                <Placeholder>{rows ? "😮 No Results" : undefined}</Placeholder>
              ) : (
                <Virtuoso
                  // Always leave room for a scrollbar so our centered group headers
                  // don't jump around when the layout reflows.
                  style={{ overflowY: "scroll" }}
                  ref={virtuoso}
                  totalCount={rows.length}
                  itemContent={(index) => (
                    <TimelineRow
                      db={db}
                      isLast={index === rows.length - 1}
                      metadata={metadata || new Map()}
                      provider={provider}
                      row={rows[index]}
                      selected={selected}
                      setSelected={(slug) =>
                        filter &&
                        navigate(
                          `/${provider.slug}/timeline:${filter}` +
                            (selected === slug ? "" : `@${slug}`)
                        )
                      }
                    />
                  )}
                  rangeChanged={(range) => setRangeStart(range.startIndex)}
                />
              )}
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              {selected && selectedEntry && (
                <span>From {selectedEntry.file.slice(1).join("/")}:</span>
              )}
            </div>
            <div className={styles.box}>
              {selected && <FilePreview>{selectedEntry?.value}</FilePreview>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Timeline;
