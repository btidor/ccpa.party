// @flow
import * as React from "react";

import styles from "components/Numeral.module.css";

function Numeral(props: {| +children: React.Node |}): React.Node {
  if (typeof props.children === "string") {
    return <span className={styles.numeral}>{props.children}</span>;
  } else {
    return <span className={styles.iconNumeral}>{props.children}</span>;
  }
}

export default Numeral;
