import { z } from "zod";

export const settleReceivableSchema = z.object({
  receivableId: z
    .string({ error: "ID do recebível obrigatório" })
    .min(1),
  amount: z
    .number({ error: "Valor obrigatório" })
    .positive("Valor deve ser maior que zero"),
  paymentMethod: z.enum(["pix", "ted", "stellar"], {
    error: "Método de pagamento inválido",
  }),
});

export type SettleReceivableFormValues = z.infer<typeof settleReceivableSchema>;
