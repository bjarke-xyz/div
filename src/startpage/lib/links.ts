export interface LinkModel {
  type: "link" | "popup";
  category: string;
  href: string;
  label: string;
  args: {
    width: number;
  };
}
