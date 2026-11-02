"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAdminCommand, useAdminQuery, useAdminSession } from "../hooks";
import { deleteMember } from "../services";
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

export function MemberDeletionPanel({
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
  const router = useRouter();
  const queries = useQueryClient();
  const session = useAdminSession();
  return (
    <Panel title="회원 및 업무 기록 삭제" padded>
      <Message>
        회원 정보와 로그인 연결, 학습·평가·결제·문의·개인 문장 등 서비스에
        저장된 기록을 삭제합니다. 이 화면에서 복구할 수 없습니다. 별도 보관소의
        음성·평가 원본 파일은 삭제하지 않습니다. 결제 기록을 지워도 결제 취소나
        환불이 실행되지는 않습니다.
      </Message>
      {self && (
        <Message>
          현재 로그인한 관리자 본인의 계정은 여기서 삭제할 수 없습니다.
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
        회원 삭제하기
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
            <DialogTitle>회원과 업무 기록을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {member.nickname} · 회원 번호 {member.id}. 회원과 연결된 서비스
              기록을 삭제합니다. 최소한의 삭제 확인·관리 작업 기록은 남깁니다.
              다른 회원과 공용 콘텐츠는 삭제하지 않습니다.
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
                  deleteMember(
                    member.id,
                    updatedAt,
                    String(data.get("confirmation") ?? ""),
                    String(data.get("reason") ?? ""),
                  ),
                () => {
                  setOpen(false);
                  const path = `/users/${member.id}`;
                  queries.removeQueries({
                    predicate: (query) =>
                      query.queryKey[0] === "admin" &&
                      query.queryKey[1] === session &&
                      typeof query.queryKey[2] === "string" &&
                      (query.queryKey[2] === path ||
                        query.queryKey[2].startsWith(`${path}/`)),
                  });
                  router.replace("/admin/users");
                },
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
                {command.busy ? "삭제 중…" : "회원 삭제하기"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
