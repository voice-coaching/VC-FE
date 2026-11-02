"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAdminCommand, useAdminQuery } from "../hooks";
import { adminApi } from "../api";
import { identifierValue } from "../services";
import { USER_RESOURCES } from "../types";
import type {
  AdminPage,
  Member,
  MemberOverview,
  MemberRecord,
  UserResource,
  IdentifierMatch,
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
  CommandFeedback,
  formatDate,
  label,
} from "./shared";
import styles from "../admin.module.css";
export function MembersPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Query>({});
  const [matches, setMatches] = useState<IdentifierMatch[] | null>(null);
  const resolve = useAdminCommand();
  const members = useAdminQuery<AdminPage<Member>>("/users", {
    ...filters,
    page,
    size: 20,
  });
  return (
    <>
      <Heading
        title="회원 관리"
        description="회원 상태와 이용등급, 관련 학습 기록을 확인하세요."
      />
      <Panel
        title="전체 회원"
        description="실제 관리자 권한과 테스트 이용등급은 서로 다른 값입니다."
      >
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPage(0);
            setFilters({
              keyword: String(data.get("keyword") ?? ""),
              status: String(data.get("status") ?? ""),
              role: String(data.get("role") ?? ""),
            });
          }}
        >
          <Field
            name="keyword"
            label="회원 검색"
            placeholder="닉네임, 이메일, 회원 번호"
            maxLength={200}
          />
          <Select name="status" label="회원 상태">
            <option value="">전체 상태</option>
            {["ACTIVE", "SUSPENDED", "WITHDRAWN"].map((status) => (
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
                  {members.data.items.map((member) => (
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
      <Panel
        title="분석 UUID로 회원 찾기"
        description="분석 요청·실행·직접 분석 작업 ID 또는 숫자 회원 번호로 조회합니다."
        padded
      >
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const identifier = String(
              new FormData(event.currentTarget).get("identifier") ?? "",
            );
            setMatches(null);
            void resolve.run(
              () =>
                adminApi.read<IdentifierMatch[]>("/users/resolve", {
                  identifier: identifierValue(identifier),
                }),
              setMatches,
            );
          }}
        >
          <Field
            label="회원 번호 또는 UUID"
            name="identifier"
            required
            maxLength={36}
            placeholder="분석 요청 UUID를 입력해 주세요."
          />
          <div>
            <Button type="submit" disabled={resolve.busy}>
              연결된 회원 조회
            </Button>
          </div>
        </form>
        <CommandFeedback command={resolve} />
        {matches && (
          <div className="mt-5">
            {matches.length === 0 ? (
              <Message>해당 ID에 연결된 회원이 없습니다.</Message>
            ) : (
              matches.map((match) => (
                <p key={`${match.userId}-${match.source}`} className="mb-2">
                  <ButtonLink href={`/admin/users/${match.userId}`}>
                    회원 #{match.userId} 보기
                  </ButtonLink>
                  <span className={styles.muted}> · {match.source}</span>
                </p>
              ))
            )}
          </div>
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
    !!overview.data,
  );
  const user = overview.data?.user;
  const usage = overview.data?.coachingUsage;
  return (
    <>
      <Heading
        title={user ? `${user.nickname}님의 기록` : "회원 상세"}
        description={`회원 #${userId}의 이용 현황과 관련 기록입니다.`}
      >
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
                  ["이메일", user.maskedEmail],
                  ["회원 상태", <Badge key="status" value={user.status} />],
                  ["실제 권한", label(user.role)],
                  [
                    "이용등급",
                    <Badge key="membership" value={user.membershipType} />,
                  ],
                  ["이용 환경", user.membershipEnvironment],
                  ["이용 종료", formatDate(user.membershipExpiresAt)],
                  ["로그인 방식", user.loginProviders.join(", ")],
                  ["가입일", formatDate(user.createdAt)],
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
          <Panel
            title="관련 기록"
            description="개인 원문·비밀번호·토큰·원본 녹음 주소는 표시하지 않습니다."
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
              <Message>이 기록은 TEST 결제 환경의 원장입니다.</Message>
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
                        <th key={key}>{key}</th>
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
                            {value === null ? "—" : String(value)}
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
