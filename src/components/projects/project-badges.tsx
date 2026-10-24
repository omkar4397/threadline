import { Badge } from "@/components/ui/misc";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import type { ProjectRisk } from "@/lib/scheduling";
import type { Project } from "@/lib/types";

export function ProjectBadges({ project, risk }: { project: Project; risk: ProjectRisk }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {project.status !== "active" ? <Badge tone={project.status === "completed" ? "success" : "neutral"}>{PROJECT_STATUS_LABEL[project.status]}</Badge> : null}
      {risk.atRisk ? <Badge tone="risk">⚠ At risk</Badge> : null}
    </span>
  );
}
