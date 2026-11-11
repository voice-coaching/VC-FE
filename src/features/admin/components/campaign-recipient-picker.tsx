"use client";
import { useState } from "react";
import { useAdminQuery } from "../hooks";
import {
  MAX_CAMPAIGN_RECIPIENTS,
  selectRecipients,
  type SelectedRecipient,
} from "../recipient-selection";
import type { AdminPage, Member } from "../types";
import { Button, Field, LoadState, Pager } from "./shared";
import styles from "../admin.module.css";

export function CampaignRecipientPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: SelectedRecipient[];
  onChange: (members: SelectedRecipient[]) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const members = useAdminQuery<AdminPage<Member>>("/users", {
    status: "ACTIVE",
    keyword,
    page,
    size: 20,
  });
  const active =
    members.data?.items.filter((member) => member.status === "ACTIVE") ?? [];
  const ids = new Set(selected.map((member) => member.id));
  const search = () => {
    setPage(0);
    setKeyword(input.trim());
  };
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 rounded-2xl border border-[#e5e8eb] p-4"
    >
      <legend className="px-1 font-semibold">받을 회원 선택</legend>
      <input
        type="hidden"
        name="userIds"
        value={selected.map((member) => member.id).join(",")}
      />
      <p className={styles.muted}>
        활성 회원을 체크해 선택하세요. 검색과 페이지를 바꿔도 선택은 유지됩니다.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="회원 이름 검색"
            value={input}
            maxLength={200}
            placeholder="검색 없이 목록에서도 선택할 수 있어요"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
          />
        </div>
        <Button onClick={search}>검색</Button>
        <Button
          onClick={() => {
            setInput("");
            setKeyword("");
            setPage(0);
          }}
        >
          검색 초기화
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="font-semibold">
          선택 {selected.length}명 / 최대 {MAX_CAMPAIGN_RECIPIENTS}명
        </span>
        <Button
          disabled={
            !active.length ||
            selected.length >= MAX_CAMPAIGN_RECIPIENTS ||
            members.isFetching
          }
          onClick={() => onChange(selectRecipients(selected, active))}
        >
          현재 페이지 선택
        </Button>
        <Button
          disabled={
            !active.some((member) => ids.has(member.id)) || members.isFetching
          }
          onClick={() =>
            onChange(
              selected.filter(
                (member) => !active.some((item) => item.id === member.id),
              ),
            )
          }
        >
          현재 페이지 해제
        </Button>
        <Button disabled={!selected.length} onClick={() => onChange([])}>
          선택 비우기
        </Button>
      </div>
      {selected.length > 0 && (
        <div
          aria-label="선택된 회원"
          className="flex max-h-32 flex-wrap gap-2 overflow-y-auto"
        >
          {selected.map((member) => (
            <Button
              key={member.id}
              aria-label={`회원 #${member.id} 선택 해제`}
              onClick={() =>
                onChange(selected.filter((item) => item.id !== member.id))
              }
            >
              {member.nickname ?? "회원"} #{member.id} ×
            </Button>
          ))}
        </div>
      )}
      {selected.length >= MAX_CAMPAIGN_RECIPIENTS && (
        <p role="status" className={styles.muted}>
          최대 500명까지 선택할 수 있습니다. 다른 회원을 선택하려면 일부 선택을
          해제해 주세요.
        </p>
      )}
      <LoadState
        loading={members.isPending}
        error={members.error}
        empty={members.data?.items.length === 0}
        retry={() => void members.refetch()}
      />
      {!members.error && active.length > 0 && (
        <div className="max-h-80 divide-y overflow-y-auto">
          {active.map((member) => (
            <label
              key={member.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 py-2"
            >
              <input
                type="checkbox"
                aria-label={`${member.nickname} #${member.id}`}
                checked={ids.has(member.id)}
                disabled={
                  !ids.has(member.id) &&
                  selected.length >= MAX_CAMPAIGN_RECIPIENTS
                }
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? selectRecipients(selected, [member])
                      : selected.filter((item) => item.id !== member.id),
                  )
                }
              />
              <span className="min-w-0 break-words">
                <strong>{member.nickname}</strong>{" "}
                <span className={styles.muted}>
                  #{member.id} · {member.maskedEmail ?? "이메일 없음"}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      {members.data && !members.error && (
        <Pager data={members.data} onPage={setPage} />
      )}
    </fieldset>
  );
}
