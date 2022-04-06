// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { openFiles } from "parse";

import styles from "Drilldown.module.css";

import type { TimelineEntry } from "parse";
import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +filter?: string,
  +selected?: number,
|};

function grouper(item: TimelineEntry): [string, string] {
  const date = new Date(item.timestamp * 1000);
  const display = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const iso =
    date.getFullYear().toString() +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getDate().toString().padStart(2, "0");
  return [display, iso];
}

function Timeline(props: Props): React.Node {
  const { provider, filter, selected } = props;
  const navigate = useNavigate();

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
    (undefined: ?$ReadOnlyArray<TimelineEntry>)
  );
  const [start, setStart] = React.useState(0);
  React.useEffect(() => {
    (async () => {
      const db = await openFiles();
      const files = await db.getAllFromIndex(
        "files",
        "provider",
        provider.slug
      );

      const parsed = ((provider.parse(files): any).filter(
        (e) => e.type === "timeline" && selectedCategories.has(e.category)
      ): Array<TimelineEntry>);
      parsed.sort((a, b) => b.timestamp - a.timestamp);

      const items = [];
      let lastGroup;
      for (const entry of parsed) {
        if (!lastGroup) {
          lastGroup = grouper(entry);
          items.push({
            type: "group",
            label: lastGroup[0],
            value: lastGroup[1],
            first: true,
          });
        } else if (grouper(entry)[1] !== lastGroup[1]) {
          lastGroup = grouper(entry);
          items.push({
            type: "group",
            label: lastGroup[0],
            value: lastGroup[1],
          });
        }
        items.push(entry);
      }
      setItems(items);
    })();
  }, [provider, selectedCategories]);

  const renderItem = (index) => {
    if (!items?.[index]) return;
    if (items[index].type === "group") {
      return (
        <React.Fragment>
          {!items[index].first && <hr className={styles.divider} />}
          <div className={styles.group} role="row">
            {items[index].label}
          </div>
        </React.Fragment>
      );
    } else {
      return (
        <div
          onClick={() =>
            filter &&
            navigate(
              `/${provider.slug}/timeline:${filter}` +
                (selected === index ? "" : `@${index.toString()}`)
            )
          }
          className={styles.listItem}
          role="row"
          aria-selected={selected === index}
        >
          {items[index].label}
        </div>
      );
    }
  };

  const virtuoso = React.useRef<any>();
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!loaded && virtuoso.current) {
      if (selected) virtuoso.current.scrollToIndex(selected);
      setLoaded(true);
    }
  }, [items, selected, loaded, virtuoso]);

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
                  <div className={styles.filter} key={category.slug}>
                    <input
                      id={category.slug}
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

                        navigate(`/${provider.slug}/timeline:${newFilter}`);
                      }}
                    />
                    <label htmlFor={category.slug}>
                      {category.displayName}
                    </label>
                  </div>
                );
              })}
              <div className={styles.grow}></div>
              <div className={styles.activeGroup}>
                {(() => {
                  if (!items || !items[start]) return;
                  const [label, value] =
                    items[start].type === "timeline"
                      ? grouper(items[start])
                      : [items[start].label, items[start].value];
                  return (
                    <React.Fragment>
                      <label>
                        {label}
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
                rangeChanged={(range) => setStart(range.startIndex)}
              />
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              {selected !== undefined &&
                items?.[selected]?.type === "timeline" &&
                `From ${items[selected].file.path}:`}
            </div>
            <div className={styles.inspector}>
              {selected !== undefined &&
                items?.[selected]?.type === "timeline" && (
                  <pre>
                    {JSON.stringify(items[selected].value, undefined, 2)}
                  </pre>
                )}
            </div>
          </div>
        </div>
      </main>
    </Theme>
  );
}

export default Timeline;
