// @flow
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

import styles from "components/Fader.module.css";

export function Fader(props: {| +children: React.Node |}): React.Node {
  return (
    <div className={styles.outer}>
      <AnimatePresence>{props.children}</AnimatePresence>
    </div>
  );
}

// Must set "key" on each instance
export function FaderItem(props: {| +children: React.Node |}): React.Node {
  return (
    <motion.div exit={{ opacity: 0, zIndex: 1 }} className={styles.inner}>
      {props.children}
    </motion.div>
  );
}
