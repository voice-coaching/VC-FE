"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAdminCommand, useAdminQuery } from "../hooks";
import { withdrawMember } from "../services";
import type { AdminAccess, Member } from "../types";
import {
  Panel,
  Message,
  Button,
  Field,
  Reason,
  CommandFeedback,
} from "./shared";
import styles from "../admin.module.css";

export function MemberWithdrawalPanel({
  member,
  updatedAt,
}: {
  member: Member;
  updatedAt: string | null | undefined;
}) {
  const actor = useAdminQuery<AdminAccess>("/me");
  const command = useAdminCommand();
  const [open, setOpen] = useState(false);
  const self = actor.data?.id === member.id;
  if (member.status === "WITHDRAWN")
    return (
      <Panel title="탈퇴 처리" padded>
        <Message>
          탈퇴 처리된 회원입니다. 남아 있는 학습·결제 내역은 계속 확인할 수
          있습니다.
        </Message>
      </Panel>
    );
  return (
    <Panel title="회원 탈퇴 처리" padded>
      <Message>
        회원의 이메일·로그인 연결을 정리하고 이름을 익명으로 바꿉니다. 개인
        문장은 정리하며 녹음 파일은 삭제 대상으로 등록합니다. 학습·결제 내역은
        보존됩니다.
      </Message>
      {self && (
        <Message>
          현재 로그인한 관리자 본인의 계정은 여기서 탈퇴 처리할 수 없습니다.
        </Message>
      )}
      {updatedAt === undefined && (
        <Message>
          회원의 최근 변경 정보를 확인한 뒤 처리할 수 있습니다. 최신 상태를 다시
          조회해 주세요.
        </Message>
      )}
      <Button
        danger
        disabled={
          self ||
          updatedAt === undefined ||
          !actor.data ||
          actor.isError ||
          command.busy
        }
        onClick={() => {
          command.clearFeedback();
          setOpen(true);
        }}
      >
        탈퇴 처리하기
      </Button>
      {!open && <CommandFeedback command={command} />}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!command.busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 회원을 탈퇴 처리할까요?</DialogTitle>
            <DialogDescription>
              {member.nickname} · 회원 번호 {member.id}. 로그인과 서비스 이용이
              중단됩니다. 학습·결제 기록은 남으며 이 화면에서 복구할 수
              없습니다.
            </DialogDescription>
          </DialogHeader>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              if (updatedAt === undefined) return;
              void command.run(
                () =>
                  withdrawMember(
                    member.id,
                    updatedAt,
                    String(data.get("confirmation") ?? ""),
                    String(data.get("reason") ?? ""),
                  ),
                () => setOpen(false),
              );
            }}
          >
            <Field
              name="confirmation"
              label="확인할 회원 번호"
              type="number"
              min={1}
              required
              placeholder={String(member.id)}
            />
            <Reason />
            <CommandFeedback command={command} />
            <div className={styles.actions}>
              <Button disabled={command.busy} onClick={() => setOpen(false)}>
                돌아가기
              </Button>
              <Button danger type="submit" disabled={command.busy}>
                {command.busy ? "탈퇴 처리 중…" : "탈퇴 처리하기"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
