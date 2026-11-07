"use client";
import { OverviewPage } from "./overview";
import { MembersPage, MemberDetail } from "./members";
import { ContentsPage, ContentDetail } from "./contents";
import {
  NoticesPage,
  NoticeDetail,
  InquiriesPage,
  InquiryDetail,
} from "./support";
import {
  CampaignsPage,
  CampaignDetail,
  PopupsPage,
  PopupDetail,
} from "./communications";
import { AuditPage } from "./audit";
import { TitleExamPoliciesPage } from "./title-exam-policies";
export function AdminRouter({
  section,
  id,
  creating = false,
}: {
  section: string;
  id?: number;
  creating?: boolean;
}) {
  switch (section) {
    case "title-exams":
      return <TitleExamPoliciesPage />;
    case "users":
      return id ? <MemberDetail userId={id} /> : <MembersPage />;
    case "contents":
    case "announcer":
      return id || creating ? (
        <ContentDetail contentId={id} announcer={section === "announcer"} />
      ) : (
        <ContentsPage announcer={section === "announcer"} />
      );
    case "notices":
      return id || creating ? <NoticeDetail noticeId={id} /> : <NoticesPage />;
    case "inquiries":
      return id ? <InquiryDetail inquiryId={id} /> : <InquiriesPage />;
    case "notifications":
      return id || creating ? (
        <CampaignDetail campaignId={id} />
      ) : (
        <CampaignsPage />
      );
    case "popups":
      return id || creating ? <PopupDetail popupId={id} /> : <PopupsPage />;
    case "audit":
      return <AuditPage />;
    default:
      return <OverviewPage />;
  }
}
