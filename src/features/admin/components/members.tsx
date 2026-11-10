"use client";
import { useState } from "react";
import Link from "next/link";
import { recordColumnLabel, displayRecordValue } from "../presentation";
import { MemberDeletionPanel } from "./member-deletion";
import { MemberRolePanel } from "./member-role";
import { Search } from "lucide-react";
import { useAdminQuery } from "../hooks";
import { USER_RESOURCES } from "../types";
import type {
  AdminPage,
  Member,
  MemberOverview,
  MemberRecord,
  UserResource,
  Query,
} from "../types";
import {
  Heading,
  Panel,
  Badge,
  Button,
  ButtonLink,
  LoadState,
  Pager,
  Field,
  Select,
  Message,
  DetailList,
  formatDate,
  label,
} from "./shared";
import styles from "../admin.module.css";
export function MembersPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Query>({});
  const members = useAdminQuery<AdminPage<Member>>("/users", {
    ...filters,
    page,
    size: 20,
  });
  return (
    <>
      <Heading
        title="회원 관리"
        description="탈퇴하지 않은 회원의 상태와 이용등급, 관련 학습 기록을 확인하세요."
      >
        <Button
          disabled={members.isFetching}
          onClick={() => void members.refetch()}
        >
          새로고침
        </Button>
      </Heading>
      <Panel
        title="전체 회원"
        description="실제 관리자 권한과 시험 이용권은 서로 다른 값입니다."
      >
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPage(0);
            setFilters({
              keyword: String(data.get("keyword") ?? "").trim(),
              status: String(data.get("status") ?? ""),
              role: String(data.get("role") ?? ""),
            });
          }}
        >
          <Field
            name="keyword"
            label="이름 검색"
            placeholder="회원 이름(닉네임)을 입력해 주세요."
            maxLength={200}
          />
          <Select name="status" label="회원 상태">
            <option value="">전체 상태</option>
            {["ACTIVE", "SUSPENDED"].map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </Select>
          <Select name="role" label="관리 권한">
            <option value="">전체 권한</option>
            <option value="USER">일반 회원</option>
            <option value="ADMIN">관리자</option>
          </Select>
          <Button type="submit">
            <Search size={14} />
            조회
          </Button>
        </form>
        <LoadState
          loading={members.isPending}
          error={members.error}
          empty={members.data?.items.length === 0}
          retry={() => void members.refetch()}
        />
        {members.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>회원 상태</th>
                    <th>권한</th>
                    <th>이용등급</th>
                    <th>가입일</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {members.data.items
                    .filter((member) => member.status !== "WITHDRAWN")
                    .map((member) => (
                      <tr key={member.id}>
                        <td>
                          <Link href={`/admin/users/${member.id}`}>
                            {member.nickname}
                          </Link>
                          <small>
                            #{member.id} · {member.maskedEmail ?? "이메일 없음"}
                          </small>
                        </td>
                        <td>
                          <Badge value={member.status} />
                        </td>
                        <td>{label(member.role)}</td>
                        <td>
                          <Badge value={member.membershipType} />
                        </td>
                        <td>{formatDate(member.createdAt)}</td>
                        <td>
                          <Link href={`/admin/users/${member.id}`}>상세 →</Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Pager data={members.data} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
export function MemberDetail({ userId }: { userId: number }) {
  const overview = useAdminQuery<MemberOverview>(`/users/${userId}/overview`);
  const [resource, setResource] = useState<UserResource>("TRAINING_SESSIONS");
  const [page, setPage] = useState(0);
  const records = useAdminQuery<AdminPage<MemberRecord>>(
    `/users/${userId}/records`,
    { resource, page, size: 20 },
    Number.isSafeInteger(userId) && userId > 0,
  );
  const user =
    overview.data?.user.status === "WITHDRAWN"
      ? undefined
      : overview.data?.user;
  const usage = overview.data?.coachingUsage;
  const account = overview.data?.account;
  return (
    <>
      <Heading
        title={user ? `${user.nickname}님의 기록` : "회원 상세"}
        description={`회원 #${userId}의 이용 현황과 관련 기록입니다.`}
      >
        <Button
          disabled={overview.isFetching}
          onClick={() =>
            void Promise.all([overview.refetch(), records.refetch()])
          }
        >
          최신 상태 조회
        </Button>
        <ButtonLink href="/admin/users">회원 목록</ButtonLink>
      </Heading>
      <LoadState
        loading={overview.isPending}
        error={overview.error}
        retry={() => void overview.refetch()}
      />
      {user && (
        <>
          <div className={styles.grid}>
            <Panel title="회원 정보" padded>
              <DetailList
                items={[
                  ["회원 번호", `#${user.id}`],
                  ["이메일", account?.email ?? user.maskedEmail],
                  ["회원 상태", <Badge key="status" value={user.status} />],
                  ["접근 권한", label(user.role)],
                  [
                    "이용등급",
                    <Badge key="membership" value={user.membershipType} />,
                  ],
                  ["이용 환경", label(user.membershipEnvironment)],
                  ["이용 종료", formatDate(user.membershipExpiresAt)],
                  ["로그인 방식", user.loginProviders.map(label).join(", ")],
                  ["가입일", formatDate(user.createdAt)],
                  ["최근 로그인", formatDate(account?.lastLoginAt)],
                  ["정보 변경일", formatDate(account?.updatedAt)],
                  ["탈퇴일", formatDate(account?.withdrawnAt)],
                  ["이용약관 동의일", formatDate(account?.termsAgreedAt)],
                  ["개인정보 동의일", formatDate(account?.privacyAgreedAt)],
                ]}
              />
            </Panel>
            <Panel title="현재 코칭 이용 현황" padded>
              {usage ? (
                <DetailList
                  items={[
                    ["사용한 코칭", usage.used.toLocaleString()],
                    ["접수 중", usage.reserved.toLocaleString()],
                    [
                      "남은 횟수",
                      usage.unlimited
                        ? "횟수 제한 없음"
                        : (usage.remaining?.toLocaleString() ?? "—"),
                    ],
                    ["이용 종료", formatDate(usage.expiresAt)],
                    [
                      "코칭 요청",
                      usage.canRequestCoaching ? "이용 가능" : "이용 제한",
                    ],
                  ]}
                />
              ) : (
                <Message>
                  비활성 회원은 현재 이용 가능량을 표시하지 않습니다.
                </Message>
              )}
            </Panel>
          </div>
          {account && (
            <Panel title="간편 로그인 연결" padded>
              {account.loginConnections.length ? (
                account.loginConnections.map((connection, index) => (
                  <div key={`${connection.provider}-${index}`} className="mb-4">
                    <DetailList
                      items={[
                        ["로그인 방식", label(connection.provider)],
                        [
                          "연결 이메일",
                          connection.email ?? "제공된 이메일 없음",
                        ],
                        ["연결일", formatDate(connection.connectedAt)],
                      ]}
                    />
                  </div>
                ))
              ) : (
                <Message>연결된 간편 로그인 계정이 없습니다.</Message>
              )}
            </Panel>
          )}
          <MemberRolePanel member={user} />
          <MemberDeletionPanel member={user} updatedAt={account?.updatedAt} />
          <Panel
            title="관련 기록"
            description="민감한 개인정보와 비밀 인증 정보는 표시하지 않습니다."
            padded
          >
            <div className={styles.tabs}>
              {USER_RESOURCES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={resource === value}
                  onClick={() => {
                    setResource(value);
                    setPage(0);
                  }}
                >
                  {label(value)}{" "}
                  <span>
                    {overview.data?.counts.find(
                      (count) => count.resource === value,
                    )?.count ?? 0}
                  </span>
                </button>
              ))}
            </div>
            {(resource === "PAYMENTS" || resource === "CANCELLATIONS") && (
              <Message>실제 청구가 발생하지 않는 시험 결제 내역입니다.</Message>
            )}
            <LoadState
              loading={records.isPending}
              error={records.error}
              empty={records.data?.items.length === 0}
              retry={() => void records.refetch()}
            />
            {!!records.data?.items.length && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {Object.keys(records.data.items[0].fields).map((key) => (
                        <th key={key}>{recordColumnLabel(key)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.data.items.map((record, index) => (
                      <tr key={index}>
                        {Object.entries(record.fields).map(([key, value]) => (
                          <td
                            key={key}
                            className={
                              typeof value === "string" && value.length > 30
                                ? styles.mono
                                : undefined
                            }
                          >
                            {displayRecordValue(resource, key, value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {records.data && <Pager data={records.data} onPage={setPage} />}
          </Panel>
        </>
      )}
    </>
  );
}
