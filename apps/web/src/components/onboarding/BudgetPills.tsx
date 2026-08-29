"use client";

import { budgetEnum } from "@farol/shared";
import { SegmentedControl } from "./SegmentedControl";

const BUDGET_LABELS: Record<string, string> = {
  economico: "Econômico",
  medio: "Médio",
  conforto: "Conforto",
  luxo: "Luxo"
};

export function BudgetPills({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const options = budgetEnum.options.map((entry) => ({
    value: entry,
    label: BUDGET_LABELS[entry] ?? entry
  }));
  return (
    <SegmentedControl
      label="Orçamento por pessoa"
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
