import type { Row } from "@/lib/database.types";

export type Client = Row<"clients">;
export type Project = Row<"projects">;
export type Task = Row<"tasks">;
export type Stage = Row<"stage_templates">;
export type Vendor = Row<"vendors">;
export type Designer = Row<"designers">;
export type Expense = Row<"expenses">;
export type ExpenseCategory = Row<"expense_categories">;
export type PricingItemType = Row<"pricing_item_types">;
export type PricingProduct = Row<"pricing_products">;
export type PricingLine = Row<"pricing_lines">;
export type ProjectFxRate = Row<"project_fx_rates">;

/** Lookups the task editor needs, passed from server pages to client components. */
export type TaskContext = {
  projects: Project[];
  clients: Client[];
  vendors: Vendor[];
  designers: Designer[];
  stages: Stage[];
  /** All tasks the editor may need to shift, i.e. every task of the affected projects. */
  tasks: Task[];
  /** Expenses of the same projects, when the screen shows them. */
  expenses?: Expense[];
};
