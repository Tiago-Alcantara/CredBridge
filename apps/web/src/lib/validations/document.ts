import { z } from "zod";

export const uploadDocumentSchema = z.object({
  receivableId: z
    .string({ error: "ID do recebível obrigatório" })
    .min(1),
  type: z.enum(["nota_fiscal", "duplicata", "contrato", "outro"], {
    error: "Tipo de documento inválido",
  }),
  file: z.instanceof(File, { message: "Arquivo obrigatório" }),
});

export type UploadDocumentFormValues = z.infer<typeof uploadDocumentSchema>;
