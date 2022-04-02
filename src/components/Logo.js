// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import styles from "components/Logo.module.css";

function Logo(): React.Node {
  return (
    <Link to="/" className={styles.logo}>
      🎉 ccpa.party
      <sup>
        {"{"}&alpha;{"}"}
      </sup>
    </Link>
  );
}

export default Logo;
