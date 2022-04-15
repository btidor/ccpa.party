// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { Database } from "database";

import styles from "Drilldown.module.css";

import type { TimelineEntry, TimelineEntryKey } from "database";
import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +filter?: string,
  +selected?: string,
|};

type Group = {| +type: "group", value: string, first?: boolean |};

const VerboseDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function Timeline(props: Props): React.Node {
  const { provider, filter, selected } = props;
  const navigate = useNavigate();
  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new Database(() => setEpoch(epoch + 1)),
    [epoch]
  );

  React.useEffect(() => {
    if (!filter) {
      const defaultFilter = provider.timelineCategories
        .filter((cat) => cat.defaultEnabled)
        .map((cat) => cat.char)
        .join("");
      navigate(`/${provider.slug}/timeline:${defaultFilter}`, {
        replace: true,
      });
    }
  }, [provider, filter, navigate]);

  const selectedCategories = React.useMemo(() => {
    const chars = filter === undefined || filter === "-" ? [] : [...filter];
    return new Map(
      chars.map((ch) => {
        const category = provider.timelineCategories.find(
          (cat) => cat.char === ch
        );
        if (!category) throw new Error("Category not found: " + ch);
        return [category.slug, category];
      })
    );
  }, [provider, filter]);

  const [items, setItems] = React.useState(
    (undefined: ?$ReadOnlyArray<TimelineEntryKey | Group>)
  );
  const [metadata, setMetadata] = React.useState(new Map<string, any>());
  const [range, setRange] = React.useState([0, 0]);
  React.useEffect(() => {
    (async () => {
      const all = await db.getTimelineEntriesForProvider(provider);
      if (all.length === 0) navigate(`/${provider.slug}/import`);
      const parsed = all
        .filter((e) => selectedCategories.has(e.category))
        .reverse();

      const metadata = new Map(
        (await db.getMetadatasForProvider(provider)).map((e) => [
          e.key,
          e.value,
        ])
      );
      setMetadata(metadata);

      const items = ([]: Array<TimelineEntryKey | Group>);
      let lastGroup;
      for (const entry of parsed) {
        if (entry.day !== lastGroup) {
          items.push({
            type: "group",
            value: entry.day,
            first: lastGroup === undefined,
          });
          lastGroup = entry.day;
        }
        items.push(entry);
      }
      setItems((items: $ReadOnlyArray<TimelineEntryKey | Group>));
    })();
  }, [db, navigate, provider, selectedCategories]);

  const [hydration, setHydration] = React.useState(
    new Map<number, ?TimelineEntry>()
  );
  const [drilldownItem, setDrilldownItem] = React.useState(
    (undefined: ?TimelineEntry)
  );
  React.useEffect(() => {
    (async () => {
      const hydration = new Map<number, ?TimelineEntry>();
      const [start, end] = range;
      for (let i = start - 10; i <= end + 10; i++) {
        const item = items?.[i];
        if (!item || item.type !== "timeline") continue;
        hydration.set(i, await db.hydrateTimelineEntry(item));
      }
      setHydration(hydration);

      if (selected) {
        const drilldownItem = await db.getTimelineEntryBySlug(
          provider,
          selected
        );
        if (
          !drilldownItem ||
          !selectedCategories.has(drilldownItem?.category)
        ) {
          filter &&
            navigate(`/${provider.slug}/timeline:${filter}`, { replace: true });
        }
        setDrilldownItem(drilldownItem);
      }
    })();
  }, [
    db,
    filter,
    items,
    navigate,
    provider,
    range,
    selected,
    selectedCategories,
  ]);

  const renderItem = (index) => {
    const item = (items?.[index]: ?(TimelineEntryKey | Group));
    if (!item || !items) return;
    if (item.type === "group") {
      return (
        <React.Fragment>
          {!item.first && <hr className={styles.divider} />}
          <div className={styles.group} role="row">
            {VerboseDateFormat.format(new Date(item.value))}
          </div>
        </React.Fragment>
      );
    } else {
      const hydrated = hydration.get(index);
      return (
        <div
          onClick={() =>
            hydrated &&
            filter &&
            navigate(
              `/${provider.slug}/timeline:${filter}` +
                (selected === hydrated.slug ? "" : `@${hydrated.slug}`)
            )
          }
          className={
            styles.listItem +
            (index === items.length - 1 ? " " + styles.last : "")
          }
          role="row"
          aria-selected={hydrated && selected === hydrated.slug}
        >
          {hydrated ? (
            provider.render(hydrated, metadata)
          ) : (
            <code className={styles.loading}>Loading...</code>
          )}
        </div>
      );
    }
  };

  const virtuoso = React.useRef<any>();
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!loaded && virtuoso.current && items) {
      const index =
        selected &&
        items.findIndex((e) => e.type === "timeline" && e.slug === selected);
      index && virtuoso.current.scrollToIndex(index - 3);
      setLoaded(true);
    }
  }, [items, loaded, selected, virtuoso]);

  return (
    <Theme provider={provider}>
      <Navigation provider={provider} pageSlug="timeline" />
      <main className="thin">
        <div className={styles.container} style={{ "--left-width": "60vw" }}>
          <div className={styles.left}>
            <div className={styles.bar}>
              {provider.timelineCategories.map((category) => {
                const checked = selectedCategories.has(category.slug);
                return (
                  <label className={styles.filter} key={category.slug}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        let newFilter = provider.timelineCategories
                          .filter((cat) =>
                            cat.slug === category.slug
                              ? !checked
                              : selectedCategories.has(cat.slug)
                          )
                          .map((c) => c.char)
                          .join("");
                        if (newFilter === "") newFilter = "-";

                        navigate(
                          `/${provider.slug}/timeline:${newFilter}${
                            selected ? "@" + selected : ""
                          }`
                        );
                      }}
                    />
                    {category.displayName}
                  </label>
                );
              })}
              <div className={styles.grow}></div>
              <div className={styles.activeGroup}>
                {(() => {
                  if (!items || !items[range[0]]) return;
                  const value =
                    items[range[0]].type === "timeline"
                      ? items[range[0]].day
                      : items[range[0]].value;
                  return (
                    <React.Fragment>
                      <label>
                        {VerboseDateFormat.format(new Date(value))}
                        <input
                          type="date"
                          value={value}
                          onChange={(e) => {
                            let target = 0;
                            for (const [index, item] of items.entries()) {
                              if (item.type !== "group") continue;
                              if (item.value < e.target.value) break;
                              target = index;
                            }
                            virtuoso.current.scrollToIndex(target);
                          }}
                        />
                      </label>
                    </React.Fragment>
                  );
                })()}
              </div>
            </div>
            {!items || items.length === 0 ? (
              <code className={styles.loading}>
                {items ? "😮 No Results" : "📊 Loading..."}
              </code>
            ) : (
              <Virtuoso
                ref={virtuoso}
                totalCount={items.length}
                itemContent={renderItem}
                rangeChanged={(range) =>
                  setRange([range.startIndex, range.endIndex])
                }
              />
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              {selected &&
                drilldownItem &&
                `From ${drilldownItem.file.slice(1).join("/")}:`}
            </div>
            {(() => {
              const classes = drilldownItem
                ? styles.inspector
                : [styles.inspector, styles.loading].join(" ");
              return (
                <div className={classes}>
                  {selected &&
                    (drilldownItem ? (
                      <pre>
                        {JSON.stringify(drilldownItem.value, undefined, 2)}
                      </pre>
                    ) : (
                      <code>📊 Loading...</code>
                    ))}
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </Theme>
  );
}

export default Timeline;
