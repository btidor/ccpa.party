import React from "react";
import { Navigate, useNavigate } from "react-router-dom";

import type { Provider } from "@src/common/provider";

import styles from "@src/components/FilterBar.module.css";

type Props<T> = {
  filter: string | void;
  filterPath: (path: string) => string;
  provider: Provider<T>;
};

function FilterBar<T>(props: Props<T>): JSX.Element {
  const { filter, filterPath, provider } = props;
  const navigate = useNavigate();

  const validChars = React.useMemo(
    () =>
      new Set(
        Array.from(provider.timelineCategories.values()).map((cat) => cat.char)
      ),
    [provider]
  );

  if (filter === undefined) {
    // Redirect `/timeline` to `/timeline:defaultCategories`
    const defaultFilter = Array.from(provider.timelineCategories.values())
      .filter((cat) => cat.defaultEnabled)
      .map((cat) => cat.char)
      .join("");
    return <Navigate to={filterPath(defaultFilter)} replace />;
  } else if (Array.from(filter).some((ch) => !validChars.has(ch))) {
    // Strip invalid categories from URL
    const filteredFilter = Array.from(filter)
      .filter((ch) => validChars.has(ch))
      .join("");
    return <Navigate to={filterPath(filteredFilter)} replace />;
  } else {
    return (
      <React.Fragment>
        {Array.from(provider.timelineCategories.entries()).map(
          ([slug, category]) => {
            const checked = filter.includes(category.char);
            return (
              <label className={styles.filter} key={slug as any}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const newFilter = Array.from(
                      provider.timelineCategories.entries()
                    )
                      .filter(([islug, icat]) =>
                        islug === slug ? !checked : filter.includes(icat.char)
                      )
                      .map(([_, icat]) => icat.char)
                      .join("");
                    navigate(filterPath(newFilter));
                  }}
                />
                {category.displayName}
              </label>
            );
          }
        )}
      </React.Fragment>
    );
  }
}

export default FilterBar;
