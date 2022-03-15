// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";

import styles from "Navigator.module.css";

import type { Provider } from "provider";

type Props = {
  db: any,
  provider: Provider,
  selected: string,
};

function Navigator(props: Props): React.Node {
  const navigate = useNavigate();
  const onChange = (event) => {
    navigate(`/explore/${props.provider.slug}/${event.target.value}`);
  };

  const [views, setViews] = React.useState();
  React.useEffect(
    () => setViews(props.provider.views(props.db)),
    [props.provider, props.db]
  );

  if (!views) {
    return <React.Fragment></React.Fragment>;
  } else {
    return (
      <select
        className={styles.select}
        onChange={onChange}
        defaultValue={props.selected}
      >
        {views.map((view) => (
          <option key={view.slug} value={view.slug}>
            {view.displayName}
          </option>
        ))}
      </select>
    );
  }
}

export default Navigator;
