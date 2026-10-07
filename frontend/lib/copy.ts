export const COPY = {
  footerCopyright: `© ${new Date().getFullYear()}, Amazon Web Services, Inc. or its affiliates.`,
  zonesEmptyTitle: "No hosted zones",
  zonesEmptyBody: "You don't have any hosted zones.",
  deleteConfirmWord: "delete",
};
export const ROUTE53_HOME = "/route53/v2/home";
export const ZONES = "/route53/v2/hostedzones";
export const zoneUrl = (id: string) => `${ZONES}/${id}`;
