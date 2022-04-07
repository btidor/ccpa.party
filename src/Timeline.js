// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { Database } from "database";

import styles from "Drilldown.module.css";

import type { TimelineEntry } from "database";
import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +filter?: string,
  +selected?: number,
|};

const VerboseDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

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
  const [metadata, setMetadata] = React.useState(new Map<string, any>());
  const [start, setStart] = React.useState(0);
  React.useEffect(() => {
    (async () => {
      const db = new Database();
      const parsed = ((await db.getParsedsForProvider(provider)).filter((e) =>
        selectedCategories.has(e.category)
      ): Array<TimelineEntry>);
      parsed.sort((a, b) => b.timestamp - a.timestamp);

      const metadata = new Map(
        (await db.getMetadatasForProvider(provider)).map((e) => [
          e.key,
          e.value,
        ])
      );
      setMetadata(metadata);

      const items = [];
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
            {VerboseDateFormat.format(new Date(items[index].value))}
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
          {provider.render(items[index], metadata)}
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
                  const value =
                    items[start].type === "timeline"
                      ? items[start].day
                      : items[start].value;
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
                rangeChanged={(range) => setStart(range.startIndex)}
              />
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              {selected !== undefined &&
                items?.[selected]?.type === "timeline" &&
                `From ${items[selected].file}:`}
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
