// @flow
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

import styles from "components/Fader.module.css";

type FaderProps = {| children: React.Node |};

export function Fader(props: FaderProps): React.Node {
  return (
    <div className={styles.outer}>
      <AnimatePresence>{props.children}</AnimatePresence>
    </div>
  );
}

// MUST also set "key"
type FaderItemProps = {| children: React.Node |};

export function FaderItem(props: FaderItemProps): React.Node {
  return (
    <motion.div exit={{ opacity: 0, zIndex: 1 }} className={styles.inner}>
      {props.children}
    </motion.div>
  );
}
