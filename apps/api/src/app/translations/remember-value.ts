import type { Prisma } from '@prisma/client';
// Same transaction as the value save. Empty/base values are not TM pairs;
// historical pairs survive later locale value removal, matching normal editing.
export async function rememberValueTx(
  tx: Prisma.TransactionClient,
  projectId: string,
  baseLocale: string,
  keyId: string,
  locale: string,
  value: string,
) {
  if (!value || locale === baseLocale) return;
  const source = await tx.translation.findUnique({
    where: { keyId_localeCode: { keyId, localeCode: baseLocale } },
  });
  if (!source?.value) return;
  await tx.tmEntry.upsert({
    where: {
      projectId_localeCode_sourceLocaleCode_sourceText: {
        projectId,
        localeCode: locale,
        sourceLocaleCode: baseLocale,
        sourceText: source.value,
      },
    },
    create: {
      projectId,
      localeCode: locale,
      sourceLocaleCode: baseLocale,
      sourceText: source.value,
      targetText: value,
      keyId,
    },
    update: { targetText: value, keyId },
  });
}
