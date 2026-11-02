"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Bell, Send, Clock3 } from "lucide-react";
import { useAdminQuery, useAdminCommand } from "../hooks";
import {
  createCampaign,
  dispatchCampaign,
  savePopup,
  localDateTime,
  durationDays,
} from "../services";
import type { AdminPage, Campaign, Popup } from "../types";
import {
  Heading,
  Panel,
  Badge,
  Button,
  ButtonLink,
  LoadState,
  Pager,
  Field,
  Textarea,
  Select,
  Check,
  Reason,
  CommandFeedback,
  ConfirmAction,
  DetailList,
  Message,
  formatDate,
  label,
} from "./shared";
import styles from "../admin.module.css";
export function CampaignsPage() {
  const [page, setPage] = useState(0);
  const campaigns = useAdminQuery<AdminPage<Campaign>>(
    "/notification-campaigns",
    { page, size: 20 },
  );
  return (
    <>
      <Heading
        title="알림 발송"
        description="전체 또는 선택 회원에게 앱 내 알림을 전달하세요."
      >
        <ButtonLink href="/admin/notifications/new" primary>
          <Plus size={15} />
          알림 작성
        </ButtonLink>
      </Heading>
      <Message>
        초안을 저장한 뒤 대상과 내용을 검토하고 발송합니다. 요금제 안내는 수동
        발송이며 이용등급을 변경하지 않습니다.
      </Message>
      <Panel title="알림 내역">
        <LoadState
          loading={campaigns.isPending}
          error={campaigns.error}
          empty={campaigns.data?.items.length === 0}
          retry={() => void campaigns.refetch()}
        />
        {campaigns.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>알림</th>
                    <th>유형</th>
                    <th>대상</th>
                    <th>상태</th>
                    <th>전달 수</th>
                    <th>작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.data.items.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className={styles.wrap}>
                        <Link href={`/admin/notifications/${campaign.id}`}>
                          {campaign.title}
                        </Link>
                        <small>{campaign.body.slice(0, 65)}</small>
                      </td>
                      <td>{label(campaign.kind)}</td>
                      <td>{label(campaign.audience)}</td>
                      <td>
                        <Badge value={campaign.status} />
                      </td>
                      <td>
                        {campaign.status === "SENT"
                          ? `${campaign.sentCount.toLocaleString()}명`
                          : "발송 전"}
                      </td>
                      <td>{formatDate(campaign.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={campaigns.data} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
export function CampaignDetail({ campaignId }: { campaignId?: number }) {
  const campaign = useAdminQuery<Campaign>(
    `/notification-campaigns/${campaignId}`,
    {},
    campaignId !== undefined,
  );
  return (
    <>
      <Heading
        title={campaignId ? "알림 검토·발송" : "새 알림 작성"}
        description="내용과 대상을 확인한 뒤 명시적으로 발송해 주세요."
      >
        <ButtonLink href="/admin/notifications">알림 목록</ButtonLink>
      </Heading>
      {campaignId && (
        <LoadState
          loading={campaign.isPending}
          error={campaign.error}
          retry={() => void campaign.refetch()}
        />
      )}{" "}
      {campaignId === undefined ? (
        <CampaignEditor />
      ) : (
        campaign.data && <CampaignReview campaign={campaign.data} />
      )}
    </>
  );
}
function CampaignEditor() {
  const router = useRouter();
  const command = useAdminCommand();
  const [audience, setAudience] = useState("ALL_ACTIVE");
  return (
    <div className={styles.grid}>
      <Panel title="알림 내용" padded>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void command.run(
              () => createCampaign(data),
              (saved) => router.push(`/admin/notifications/${saved.id}`),
            );
          }}
        >
          <Select label="알림 유형" name="kind">
            <option value="GENERAL">서비스 일반 안내</option>
            <option value="PLAN">요금제 안내</option>
          </Select>
          <Select
            label="발송 대상"
            name="audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
          >
            <option value="ALL_ACTIVE">전체 활성 회원</option>
            <option value="SELECTED_USERS">선택 회원</option>
          </Select>
          {audience === "SELECTED_USERS" && (
            <Textarea
              label="회원 번호"
              name="userIds"
              required
              placeholder="예: 12, 34, 56"
              hint="회원 관리에서 확인한 숫자 ID를 쉼표나 줄바꿈으로 구분합니다. 최대 500명."
              rows={3}
            />
          )}
          <Field label="알림 제목" name="title" maxLength={200} required />
          <Textarea
            label="알림 본문"
            name="body"
            maxLength={1000}
            rows={6}
            required
          />
          <Select name="deepLink" label="알림 클릭 시 이동">
            <option value="/notifications">알림함</option>
            <option value="/mypage">마이페이지</option>
            <option value="/home">홈</option>
          </Select>
          <Reason />
          <CommandFeedback command={command} />
          <div className={styles.formFooter}>
            <Button type="submit" primary disabled={command.busy}>
              {command.busy ? "저장 중…" : "초안 저장·검토"}
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="발송 전 확인" padded>
        <div className={`${styles.previewCard} mb-6`}>
          <Bell size={24} color="#2f6bff" />
          <h3 className="mt-4">회원에게 필요한 안내를 전달하세요</h3>
          <p>
            알림은 사용자의 기존 알림함에 표시됩니다. 초안 저장만으로 발송되지
            않습니다.
          </p>
        </div>
        <Message>
          웹 푸시·이메일·결제 완료/만료 자동 알림은 포함되지 않습니다.
        </Message>
        <p className={styles.muted}>
          발송 대상은 서버가 검증합니다. 전체 안내에는 활성 관리자 계정도
          포함되며, 실제 수신자 수는 발송 시점에 결정됩니다.
        </p>
      </Panel>
    </div>
  );
}
function CampaignReview({ campaign }: { campaign: Campaign }) {
  return (
    <div className={styles.grid}>
      <Panel
        title="알림 미리보기"
        action={<Badge value={campaign.status} />}
        padded
      >
        <div className={styles.preview}>
          <div className={styles.previewCard}>
            <Bell size={23} color="#2f6bff" />
            <h3 className="mt-4">{campaign.title}</h3>
            <p>{campaign.body}</p>
          </div>
        </div>
      </Panel>
      <Panel title="발송 정보" padded>
        <DetailList
          items={[
            ["알림 번호", `#${campaign.id}`],
            ["안내 유형", label(campaign.kind)],
            ["발송 대상", label(campaign.audience)],
            [
              campaign.status === "SENT" ? "실제 전달" : "현재 예상 대상",
              `${campaign.audienceCount.toLocaleString()}명`,
            ],
            [
              "선택 회원",
              campaign.userIds.length
                ? campaign.userIds.map((id) => `#${id}`).join(", ")
                : "전체 활성 회원",
            ],
            ["이동 경로", campaign.deepLink],
            ["작성일", formatDate(campaign.createdAt)],
            ["발송일", formatDate(campaign.sentAt)],
          ]}
        />
        {campaign.status === "DRAFT" ? (
          <div className="mt-6">
            <Message>
              대상 인원은 발송 시점에 달라질 수 있습니다. 발송한 알림은 이
              화면에서 회수하거나 편집할 수 없습니다.
            </Message>
            <ConfirmAction
              title="이 알림을 발송할까요?"
              description={`${label(campaign.audience)}에게 앱 내 알림을 보냅니다. 현재 예상 ${campaign.audienceCount}명이며 발송 시점에 최종 확정됩니다.`}
              buttonLabel="검토 완료·발송하기"
              primary
              action={(reason) => dispatchCampaign(campaign, reason)}
            />
          </div>
        ) : (
          <div className="mt-6">
            <Message tone="success">
              총 {campaign.sentCount.toLocaleString()}명에게 전달했습니다. 같은
              발송 요청을 반복해도 중복 전달하지 않습니다.
            </Message>
          </div>
        )}
      </Panel>
    </div>
  );
}
export function PopupsPage() {
  const [page, setPage] = useState(0);
  const popups = useAdminQuery<AdminPage<Popup>>("/popups", { page, size: 20 });
  return (
    <>
      <Heading
        title="팝업 관리"
        description="로그인 회원에게 보여줄 공통 팝업과 노출 기간을 관리하세요."
      >
        <ButtonLink href="/admin/popups/new" primary>
          <Plus size={15} />
          팝업 등록
        </ButtonLink>
      </Heading>
      <Panel>
        <LoadState
          loading={popups.isPending}
          error={popups.error}
          empty={popups.data?.items.length === 0}
          retry={() => void popups.refetch()}
        />
        {popups.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>팝업</th>
                    <th>노출 설정</th>
                    <th>시작 시각</th>
                    <th>종료 시각</th>
                    <th>우선순위</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {popups.data.items.map((popup) => (
                    <tr key={popup.id}>
                      <td className={styles.wrap}>
                        <Link href={`/admin/popups/${popup.id}`}>
                          {popup.title}
                        </Link>
                      </td>
                      <td>
                        <Badge
                          value={popup.enabled ? "활성 설정" : "노출 중지"}
                        />
                      </td>
                      <td>{formatDate(popup.startsAt)}</td>
                      <td>{formatDate(popup.endsAt)}</td>
                      <td>{popup.priority}</td>
                      <td>
                        <Link href={`/admin/popups/${popup.id}`}>편집 →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={popups.data} onPage={setPage} />
          </>
        )}
      </Panel>
      <Message>
        활성 설정과 실제 게시 여부는 다릅니다. 서버가 현재 시각과 기간을
        확인하고, 겹치는 팝업 중 우선순위가 높은 한 개를 선택합니다.
      </Message>
    </>
  );
}
export function PopupDetail({ popupId }: { popupId?: number }) {
  const popup = useAdminQuery<Popup>(
    `/popups/${popupId}`,
    {},
    popupId !== undefined,
  );
  return (
    <>
      <Heading
        title={popupId ? "팝업 편집" : "새 팝업 작성"}
        description="게시 시작 시각과 며칠 동안 보여줄지 지정하세요."
      >
        <ButtonLink href="/admin/popups">팝업 목록</ButtonLink>
      </Heading>
      {popupId && (
        <LoadState
          loading={popup.isPending}
          error={popup.error}
          retry={() => void popup.refetch()}
        />
      )}{" "}
      {(popupId === undefined || popup.data) && (
        <PopupEditor
          key={`${popup.data?.id ?? "new"}-${popup.data?.version ?? 0}`}
          current={popup.data}
        />
      )}
    </>
  );
}
function PopupEditor({ current }: { current?: Popup }) {
  const router = useRouter();
  const command = useAdminCommand();
  const [title, setTitle] = useState(current?.title ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  return (
    <div className={styles.grid}>
      <Panel title="팝업 설정" padded>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void command.run(
              () => savePopup(data, current),
              (saved) => router.push(`/admin/popups/${saved.id}`),
            );
          }}
        >
          <Field
            name="title"
            label="제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
          <Textarea
            name="body"
            label="본문"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            rows={5}
            required
          />
          <div className={styles.formGrid}>
            <Field
              type="datetime-local"
              name="startsAt"
              label="게시 시작"
              defaultValue={localDateTime(current?.startsAt)}
              required
            />
            <Field
              type="number"
              name="durationDays"
              label="노출 일수"
              min={1}
              max={365}
              defaultValue={current ? durationDays(current) : 3}
              required
              hint="1~365일. 서버가 종료 시각을 계산합니다."
            />
            <Field
              type="number"
              name="priority"
              label="우선순위"
              min={0}
              max={100}
              defaultValue={current?.priority ?? 10}
              required
              hint="숫자가 클수록 먼저 표시합니다."
            />
            <Select
              name="deepLink"
              label="버튼 클릭 시 이동"
              defaultValue={current?.deepLink ?? ""}
            >
              <option value="">이동 없음</option>
              <option value="/home">홈</option>
              <option value="/notifications">알림함</option>
              <option value="/mypage">마이페이지</option>
            </Select>
          </div>
          <Check
            name="enabled"
            label="설정한 기간에 팝업 노출"
            defaultChecked={current?.enabled ?? false}
          />
          <Reason />
          <CommandFeedback command={command} />
          <div className={styles.formFooter}>
            <Button type="submit" primary disabled={command.busy}>
              팝업 저장
            </Button>
          </div>
        </form>
      </Panel>
      <Panel
        title="화면 미리보기"
        description="문구 배치 예시입니다. 실제 사용자 팝업 화면 연결은 별도입니다."
        padded
      >
        <div className={styles.preview}>
          <div className={styles.previewCard}>
            <Clock3 color="#2f6bff" size={24} />
            <h3 className="mt-4">{title || "팝업 제목"}</h3>
            <p>{body || "회원에게 보여줄 안내를 작성해 주세요."}</p>
            <div className="mt-6">
              <Button primary disabled>
                확인
              </Button>
            </div>
          </div>
        </div>
        {current && (
          <p className={`${styles.muted} mt-5`}>
            현재 저장된 종료 시각: {formatDate(current.endsAt)}
          </p>
        )}
      </Panel>
    </div>
  );
}
