// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import styles from "components/Logo.module.css";

function Logo(): React.Node {
  return (
    <Link to="/start" className={styles.logo}>
      🎉 ccpa.party
    </Link>
  );
}

export default Logo;
