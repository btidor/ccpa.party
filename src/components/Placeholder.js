// @flow
import * as React from "react";

import styles from "components/Placeholder.module.css";

type Props = {|
  +children?: string,
|};

const loadingMessage = "📊 Loading...";

function Placeholder(props: Props): React.Node {
  return (
    <code className={styles.placeholder}>
      {props.children || loadingMessage}
    </code>
  );
}

export default Placeholder;
