import styles from "./box.module.css";

const popup = (url: string, width?: number) =>
  window.open(
    url,
    "_blank",
    `toolbar=0,location=0,menubar=0,height=720,width=${width ?? 480}`
  );

export type BoxProps = {
  title: string;
  hidden?: boolean;
  items: {
    label: string;
    type: "link" | "popup";
    href: string;
    args?: {
      width: number;
    };
  }[];
};
export const Box = ({ title, items }: BoxProps) => {
  return (
    <div className={styles.box}>
      <div className={styles.title}>{title}</div>
      <div className={styles.content}>
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              {item.type === "popup" ? (
                <a
                  className={styles.link}
                  href="#"
                  onClick={() => popup(item.href, item.args?.width)}
                >
                  {item.label}
                </a>
              ) : (
                <a className={styles.link} href={item.href}>
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
