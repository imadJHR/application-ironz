import { statusLabels } from "@/lib/business";
export function Status({ status }: { status: string }) {
  return (
    <span className={"status status-" + status.toLowerCase()}>
      <span />
      {statusLabels[status] || status}
    </span>
  );
}
