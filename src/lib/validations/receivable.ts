import { z } from "zod";

export const createReceivableSchema = z.object({
  amount: z
    .number({ error: "Valor obrigatório" })
    .positive("Valor deve ser maior que zero"),
  dueDate: z
    .string({ error: "Data de vencimento obrigatória" })
    .min(1, "Data de vencimento obrigatória"),
  debtorName: z
    .string({ error: "Nome do devedor obrigatório" })
    .min(2, "Nome deve ter ao menos 2 caracteres"),
  debtorDocument: z
    .string({ error: "CPF/CNPJ obrigatório" })
    .min(11, "CPF/CNPJ inválido")
    .max(14, "CPF/CNPJ inválido"),
  description: z.string().optional(),
});

export type CreateReceivableFormValues = z.infer<typeof createReceivableSchema>;
