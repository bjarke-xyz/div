import React from "react";
import styles from "./box-container.module.css";

type BoxContainerProps = {
  children: React.ReactNode;
};
export const BoxContainer = ({ children }: BoxContainerProps) => {
  return <div className={styles.container}>{children}</div>;
};
