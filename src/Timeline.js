// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { GroupedVirtuoso } from "react-virtuoso";

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

function Timeline(props: Props): React.Node {
  console.warn(props);
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

  const [items, setItems] = React.useState(([]: $ReadOnlyArray<TimelineEntry>));
  React.useEffect(() => {
    (async () => {
      const db = await openFiles();
      const files = await db.getAllFromIndex(
        "files",
        "provider",
        provider.slug
      );

      const items = (provider
        .parse(files)
        .filter(
          (e) => e.type === "timeline" && selectedCategories.has(e.category)
        ): any);
      items.sort((a, b) => b.timestamp - a.timestamp);
      setItems(items);
    })();
  }, [provider, selectedCategories]);

  const groupFunc = (item) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(item.timestamp * 1000));

  const groups = items.reduce((state, item) => {
    const end = state.length - 1;
    const name = groupFunc(item);
    if (state[end]?.name !== name) {
      state.push({ name, count: 1 });
    } else {
      state[end].count++;
    }
    return state;
  }, []);

  const renderItem = (index) => {
    if (!items[index]) return;
    const lastInGroup =
      groupFunc &&
      items[index + 1] &&
      groupFunc(items[index]) !== groupFunc(items[index + 1]);
    return (
      <React.Fragment>
        <div
          onClick={() =>
            filter &&
            navigate(
              `/${provider.slug}/timeline:${filter}` +
                (selected === index ? "" : `@${index.toString()}`)
            )
          }
          className={
            styles.listItem + (!items[index + 1] ? " " + styles.last : "")
          }
          role="row"
          aria-selected={selected === index}
        >
          {items[index].label}
        </div>
        {lastInGroup && <hr className={styles.divider} />}
      </React.Fragment>
    );
  };

  return (
    <Theme provider={provider}>
      <Navigation provider={provider} pageSlug="timeline" />
      <main className="thin">
        {!items ? (
          <React.Fragment>📊 Loading...</React.Fragment>
        ) : (
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
              </div>
              {items.length === 0 ? (
                <code>No Results</code>
              ) : (
                <GroupedVirtuoso
                  groupCounts={groups.map((g) => g.count)}
                  groupContent={(index) => (
                    <div className={styles.group}>{groups[index]?.name}</div>
                  )}
                  itemContent={renderItem}
                />
              )}
            </div>
            <div className={styles.right}>
              <div className={styles.bar}>
                {selected !== undefined &&
                  !!items[selected] &&
                  `From ${items[selected].file.path}:`}
              </div>
              <div className={styles.inspector}>
                {selected !== undefined && !!items[selected] && (
                  <pre>
                    {JSON.stringify(items[selected].value, undefined, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </Theme>
  );
}

export default Timeline;
