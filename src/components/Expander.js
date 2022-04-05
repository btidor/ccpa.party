// @flow
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

type Props = {|
  +children: React.Node,
  +marginTop: string | number,
  +className?: string,
|};

// Warning! Child and grandchild components should not have top or bottom
// margins set, otherwise the animation will jump just before appearing or
// disappearing. Use marginTop instead so the margin animates smoothly.

function Expander(props: Props): React.Node {
  const root = React.useRef<?HTMLElement>();
  const probe = React.useRef<?HTMLElement>();
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);

  // Framer Motion doesn't correctly suppress the animation of marginTop when
  // setting `initial=undefined`, So while the page is loading, we set the top
  // margin on the parent, which overlaps with and masks the child's animation.
  const [hackMargin, setHackMargin] = React.useState(props.marginTop);

  React.useLayoutEffect(() => {
    if (root.current) {
      const clientWidth = root.current.clientWidth;
      const computedStyle = window.getComputedStyle(root.current);
      setWidth(
        clientWidth -
          parseFloat(computedStyle.paddingLeft) -
          parseFloat(computedStyle.paddingRight)
      );
    }
  }, [props.children]);

  React.useLayoutEffect(() => {
    if (probe.current) {
      setHeight(probe.current.offsetHeight);
    }
  }, [props.children, width]);

  React.useEffect(() => {
    setTimeout(() => setLoaded(true));
  }, []);

  const initial = { height: 0, opacity: 0, marginTop: 0 };
  const final = { height, opacity: 1, marginTop: props.marginTop };

  return (
    <AnimatePresence>
      {props.children && (
        <div
          className={props.className}
          ref={root}
          style={{ marginTop: hackMargin }}
        >
          <motion.div
            transition={{ ease: "easeInOut" }}
            initial={loaded ? initial : undefined}
            animate={final}
            exit={initial}
            onAnimationComplete={() => setHackMargin(0)}
          >
            {props.children}
          </motion.div>
          <div
            ref={probe}
            style={{
              visibility: "hidden",
              position: "absolute",
              width,
            }}
          >
            {props.children}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Expander;
