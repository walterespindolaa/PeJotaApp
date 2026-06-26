import { useMemo } from "react";

/**
 * Central mapper for responsável labels.
 * DB stores: "Pessoa 1", "Pessoa 2", "Compartilhado"
 * Display uses custom names from profile.
 * The "Compartilhado" label adapts based on vínculo type.
 */
export const useHouseholdLabels = (
  nomePessoa1: string,
  nomePessoa2: string,
  vinculoPessoa2?: string
) => {
  const compartilhadoLabel = useMemo(() => {
    switch (vinculoPessoa2) {
      case "Cônjuge":
      case "Companheiro(a)":
        return "Casal";
      case "Sócio(a)":
        return "Sócios";
      case "Filho(a)":
      case "Familiar":
        return "Familiar";
      default:
        return "Consolidado";
    }
  }, [vinculoPessoa2]);

  const labels = useMemo(() => ({
    "Pessoa 1": nomePessoa1 || "Pessoa 1",
    "Pessoa 2": nomePessoa2 || "Pessoa 2",
    "Compartilhado": compartilhadoLabel,
  }), [nomePessoa1, nomePessoa2, compartilhadoLabel]);

  const getLabel = (dbValue: string): string => {
    return labels[dbValue as keyof typeof labels] || dbValue || "—";
  };

  const responsavelOptions = useMemo(() => [
    { value: "Pessoa 1", label: labels["Pessoa 1"] },
    { value: "Pessoa 2", label: labels["Pessoa 2"] },
    { value: "Compartilhado", label: labels["Compartilhado"] },
  ], [labels]);

  const visaoOptions = useMemo(() => [
    { value: "pessoa1" as const, label: labels["Pessoa 1"] },
    { value: "pessoa2" as const, label: labels["Pessoa 2"] },
    { value: "casal" as const, label: labels["Compartilhado"] },
    { value: "geral" as const, label: "Geral" },
  ], [labels]);

  return { labels, getLabel, responsavelOptions, visaoOptions, compartilhadoLabel };
};
