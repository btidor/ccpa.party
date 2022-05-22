import styles from "components/Placeholder.module.css";

type Props = {
  children?: string;
};

const loadingMessage = "📊 Loading...";

function Placeholder(props: Props): JSX.Element {
  return (
    <code className={styles.placeholder}>
      {props.children || loadingMessage}
    </code>
  );
}

export default Placeholder;
