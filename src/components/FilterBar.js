// @flow
import * as React from "react";
import { Navigate, useNavigate } from "react-router-dom";

import styles from "components/FilterBar.module.css";

import type { Provider } from "provider";

type Props = {|
  +filter: string | void,
  +filterPath: (string) => string,
  +provider: Provider,
|};

function FilterBar(props: Props): React.Node {
  const { filter, filterPath, provider } = props;
  const navigate = useNavigate();

  const validChars = React.useMemo(
    () => new Set(provider.timelineCategories.map((cat) => cat.char)),
    [provider]
  );

  if (filter === undefined) {
    // Redirect `/timeline` to `/timeline:defaultCategories`
    const defaultFilter = provider.timelineCategories
      .filter((cat) => cat.defaultEnabled)
      .map((cat) => cat.char)
      .join("");
    return <Navigate to={filterPath(defaultFilter)} replace />;
  } else if ([...filter].some((ch) => !validChars.has(ch))) {
    // Strip invalid categories from URL
    const filteredFilter = [...filter]
      .filter((ch) => validChars.has(ch))
      .join("");
    return <Navigate to={filterPath(filteredFilter)} replace />;
  } else {
    return provider.timelineCategories.map((category) => {
      const checked = filter.includes(category.char);
      return (
        <label className={styles.filter} key={category.slug}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {
              const newFilter = provider.timelineCategories
                .filter((cat) =>
                  cat.slug === category.slug
                    ? !checked
                    : filter.includes(cat.char)
                )
                .map((c) => c.char)
                .join("");
              navigate(filterPath(newFilter));
            }}
          />
          {category.displayName}
        </label>
      );
    });
  }
}

export default FilterBar;
