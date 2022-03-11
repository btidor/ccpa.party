// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";

import styles from "Navigator.module.css";

import type { Provider, View } from "provider";

type Props = {
  provider: Provider,
  views: $ReadOnlyArray<View<any>>,
  selected: string,
};

function Navigator(props: Props): React.Node {
  const navigate = useNavigate();
  const onChange = (event) => {
    navigate(`/explore/${props.provider.slug}/${event.target.value}`);
  };
  return (
    <select
      className={styles.select}
      onChange={onChange}
      defaultValue={props.selected}
    >
      {props.views.map((view) => (
        <option key={view.slug} value={view.slug}>
          {view.displayName}
        </option>
      ))}
    </select>
  );
}

export default Navigator;
